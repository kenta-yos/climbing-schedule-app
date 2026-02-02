import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極のコンパクトCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif; background-color: #F8F9FA; }
    
    /* カードをさらにスリムに */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important; border-radius: 8px !important; 
        padding: 0.6rem 0.8rem !important; /* パディングを大幅カット */
        background-color: white !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
        margin-bottom: 0.5rem !important; /* カード間の隙間を短縮 */
    }
    
    .past-event { opacity: 0.35; filter: grayscale(1); }
    
    /* テキストサイズの最適化 */
    h3 { font-size: 1.0rem !important; font-weight: 600 !important; margin: 0 !important; line-height: 1.2; }
    .date-text { font-size: 0.8rem; font-weight: 500; color: #888; margin-bottom: 2px; }
    .status-badge { font-size: 0.65rem; padding: 1px 6px; border-radius: 8px; background: #f0f0f0; color: #999; margin-left: 5px; }
    
    /* ボタンをスリムに */
    .stButton button { padding: 0.2rem 0.5rem; font-size: 0.8rem; height: auto; }
    div[data-testid="stLinkButton"] a { padding: 4px 10px !important; font-size: 0.8rem !important; }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_data():
    m = conn.read(worksheet="gym_master", ttl=0)
    s = conn.read(worksheet="schedules", ttl=0)
    return m, s
master_df, schedule_df = load_data()

gym_usage = schedule_df['gym_name'].value_counts() if not schedule_df.empty else pd.Series()
sorted_gyms = sorted(master_df['gym_name'].tolist(), key=lambda x: gym_usage.get(x, 0), reverse=True) if not master_df.empty else []

tab1, tab2 = st.tabs(["🗓 セットスケジュール", "🔍 よく行くジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    # 冒頭の st.title を削除して即座にコンテンツを開始
    with st.expander("＋ 新規予定を追加"):
        if not sorted_gyms: st.warning("先にジムを登録してください")
        else:
            if 'date_count' not in st.session_state: st.session_state.date_count = 1
            with st.form("add_form", clear_on_submit=True):
                sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
                p_url = st.text_input("Instagram URL")
                dates = []
                for i in range(st.session_state.date_count):
                    c1, c2 = st.columns(2)
                    with c1: s_val = st.date_input(f"開始 {i+1}", key=f"s_in_{i}")
                    with c2: e_val = st.date_input(f"終了 {i+1}", key=f"e_in_{i}")
                    dates.append((s_val, e_val))
                if st.form_submit_button("保存"):
                    if sel_gym != "(選択)" and p_url:
                        new = [{"gym_name": sel_gym, "start_date": s.isoformat(), "end_date": e.isoformat(), "post_url": p_url} for s, e in dates]
                        conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new)], ignore_index=True))
                        st.session_state.date_count = 1; st.rerun()
            if st.session_state.date_count < 5:
                if st.button("＋ 日程枠を追加"): st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        today = pd.to_datetime(datetime.now().date())
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        
        all_m = sorted(s_df['month_year'].unique().tolist())
        cur_m = datetime.now().strftime('%Y年%m月')
        if cur_m not in all_m: all_m.append(cur_m); all_m.sort()
        sel_m = st.selectbox("表示月", options=all_m, index=all_m.index(cur_m), label_visibility="collapsed")
        
        month_df = s_df[s_df['month_year'] == sel_m].copy()
        if not month_df.empty:
            month_df['is_past'] = month_df['end_date'] < today
            month_df = month_df.sort_values(by=['is_past', 'start_date'], ascending=[True, True])
            
            for _, row in month_df.iterrows():
                past_tag = "past-event" if row['is_past'] else ""
                with st.container(border=True):
                    st.markdown(f"<div class='{past_tag}'><div class='date-text'>{row['start_date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}</div></div>", unsafe_allow_html=True)
                    c_info, c_link = st.columns([1.8, 1])
                    with c_info:
                        label = f"### {row['gym_name']}" + (" <span class='status-badge'>終了</span>" if row['is_past'] else "")
                        st.markdown(f"<div class='{past_tag}'>{label}</div>", unsafe_allow_html=True)
                    with c_link:
                        st.link_button("Instagram", row['post_url'], use_container_width=True)

# ==========================================
# Tab 2: よく行くジム
# ==========================================
with tab2:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("m_form", clear_on_submit=True):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True)); st.rerun()

    if not master_df.empty:
        for gym_name in sorted_gyms:
            row = master_df[master_df['gym_name'] == gym_name].iloc[0]
            with st.container(border=True):
                c_txt, c_btn = st.columns([1.8, 1])
                with c_txt: st.markdown(f"### {row['gym_name']}")
                with c_btn: st.link_button("Instagram", row['profile_url'], use_container_width=True)
