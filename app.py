import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- CSS設定 ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif; background-color: #F0F2F5; }
    
    /* カード全体のデザイン */
    .link-card {
        background-color: white;
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        text-decoration: none !important;
        display: block;
        border-left: 6px solid #2E7D32;
        transition: transform 0.1s;
    }
    .link-card:active { transform: scale(0.97); background-color: #F8F9FA; }
    
    /* 日程バッジ */
    .date-badge {
        display: inline-block;
        background-color: #E8F5E9;
        color: #2E7D32;
        padding: 2px 10px;
        border-radius: 6px;
        font-size: 1.0rem;
        font-weight: 700;
        margin-bottom: 6px;
    }
    
    /* ジム名 */
    .gym-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #1C1E21;
        margin: 0;
        line-height: 1.4;
    }
    
    /* 過去分 */
    .past-card { border-left-color: #9E9E9E; opacity: 0.6; filter: grayscale(1); }
    .status-tag {
        font-size: 0.7rem;
        background: #EEE;
        color: #666;
        padding: 2px 8px;
        border-radius: 4px;
        float: right;
        margin-top: 4px;
    }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_data():
    return conn.read(worksheet="gym_master", ttl=0), conn.read(worksheet="schedules", ttl=0)
master_df, schedule_df = load_data()

# --- 状態管理 ---
if 'date_count' not in st.session_state: st.session_state.date_count = 1
for i in range(5):
    if f's_date_{i}' not in st.session_state: st.session_state[f's_date_{i}'] = datetime.now().date()

sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

tab1, tab2 = st.tabs(["🗓 セットスケジュール", "🔍 よく行くジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    with st.expander("＋ 新規予定を追加", expanded=(st.session_state.date_count > 1)):
        if not sorted_gyms: st.warning("先にジムを登録してください")
        else:
            with st.form("add_form", clear_on_submit=True):
                sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
                p_url = st.text_input("Instagram URL")
                for i in range(st.session_state.date_count):
                    st.write(f"日程 {i+1}")
                    c1, c2 = st.columns(2)
                    with c1: s_val = st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                    with c2: e_val = st.date_input(f"終了 {i+1}", value=st.session_state[f"s_date_{i}"], key=f"e_date_{i}")
                
                if st.form_submit_button("保存"):
                    if sel_gym != "(選択)" and p_url:
                        new_data = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{i}"].isoformat(), 
                                     "end_date": st.session_state[f"e_date_{i}"].isoformat(), "post_url": p_url} for i in range(st.session_state.date_count)]
                        conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_data)], ignore_index=True))
                        st.session_state.date_count = 1; st.rerun()

            if st.session_state.date_count < 5:
                if st.button("＋ 日程枠を増やす"):
                    st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        today = pd.to_datetime(datetime.now().date())
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        all_m = sorted(s_df['month_year'].unique().tolist())
        sel_m = st.selectbox("月", options=all_m, index=all_m.index(datetime.now().strftime('%Y年%m月')) if datetime.now().strftime('%Y年%m月') in all_m else 0, label_visibility="collapsed")
        
        month_df = s_df[s_df['month_year'] == sel_m].copy()
        if not month_df.empty:
            month_df['is_past'] = month_df['end_date'] < today
            month_df = month_df.sort_values(by=['is_past', 'start_date'], ascending=[True, True])
            
            # 修正ポイント： st.container() を使わず、直接 HTML 文字列を結合して出力
            for _, row in month_df.iterrows():
                past_class = "past-card" if row['is_past'] else ""
                tag = "<span class='status-tag'>終了済</span>" if row['is_past'] else ""
                
                html_content = f"""
                <a href="{row['post_url']}" target="_blank" class="link-card {past_class}">
                    <div class="date-badge">🗓 {row['start_date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}</div>
                    {tag}
                    <div class="gym-title">{row['gym_name']}</div>
                </a>
                """
                st.markdown(html_content, unsafe_allow_html=True)

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
            st.markdown(f"""
                <a href="{row['profile_url']}" target="_blank" class="link-card">
                    <div class="gym-title">🔍 {row['gym_name']}</div>
                </a>
            """, unsafe_allow_html=True)
