import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極のスリムCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif; background-color: #FFFFFF; }
    
    /* カードから「リスト」へ */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border-top: none !important; border-left: none !important; border-right: none !important;
        border-bottom: 1px solid #F0F0F0 !important;
        border-radius: 0px !important; padding: 8px 0px !important;
        background-color: transparent !important; box-shadow: none !important;
        margin-bottom: 0px !important;
    }
    
    .past-event { opacity: 0.35; filter: grayscale(1); }
    
    /* テキストの最適化 */
    h3 { font-size: 0.95rem !important; font-weight: 500 !important; margin: 0 !important; color: #333; }
    .date-text { font-size: 0.75rem; color: #888; margin: 0 0 2px 0; font-family: monospace; }
    
    /* アイコンボタンをスタイリッシュに */
    .stButton button {
        border: none !important; background: transparent !important; 
        padding: 4px !important; font-size: 1.1rem !important;
        transition: 0.2s;
    }
    .stButton button:hover { transform: scale(1.2); }
    
    /* 編集BOXのスリム化 */
    .edit-box {
        background: #F9F9F9; border-radius: 8px; padding: 12px; margin: 8px 0;
        border: 1px solid #EEE;
    }
    
    /* リンクボタンのアイコン化 */
    div[data-testid="stLinkButton"] a {
        background-color: transparent !important; color: #555 !important;
        border: none !important; padding: 0 !important; font-size: 1.2rem !important;
    }
    </style>
    """, unsafe_allow_html=True)

# --- データ読み込み ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_data():
    m = conn.read(worksheet="gym_master", ttl=0)
    s = conn.read(worksheet="schedules", ttl=0)
    return m, s
master_df, schedule_df = load_data()

if 'edit_id' not in st.session_state: st.session_state.edit_id = None
if 'del_id' not in st.session_state: st.session_state.del_id = None

gym_usage = schedule_df['gym_name'].value_counts() if not schedule_df.empty else pd.Series()
sorted_gyms = sorted(master_df['gym_name'].tolist(), key=lambda x: gym_usage.get(x, 0), reverse=True) if not master_df.empty else []

tab1, tab2 = st.tabs(["🗓 Schedule", "🔍 My Gym"])

# ==========================================
# Tab 1: Schedule
# ==========================================
with tab1:
    with st.expander("＋ 新規登録", expanded=False):
        if not sorted_gyms: st.warning("My Gymを登録してください")
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
                if st.button("＋ 日程を追加"): st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        cur_m = datetime.now().strftime('%Y年%m月')
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        all_m = sorted(s_df['month_year'].unique().tolist())
        if cur_m not in all_m: all_m.append(cur_m); all_m.sort()
        sel_m = st.selectbox("月", options=all_m, index=all_m.index(cur_m), label_visibility="collapsed")
        
        month_df = s_df[s_df['month_year'] == sel_m].copy()
        if not month_df.empty:
            month_df['is_past'] = month_df['end_date'] < pd.to_datetime(datetime.now().date())
            month_df = month_df.sort_values(by=['is_past', 'start_date'], ascending=[True, True])
            
            for idx, row in month_df.iterrows():
                past_tag = "past-event" if row['is_past'] else ""
                with st.container(border=True):
                    c_txt, c_ins, c_edit, c_del = st.columns([7, 1.2, 1.2, 1.2])
                    with c_txt:
                        st.markdown(f"<div class='{past_tag}'><p class='date-text'>{row['start_date'].strftime('%m/%d')} ▶ {row['end_date'].strftime('%m/%d')}</p><h3>{row['gym_name']}</h3></div>", unsafe_allow_html=True)
                    with c_ins: st.link_button("📸", row['post_url'])
                    with c_edit: 
                        if st.button("✎", key=f"ed_s_{idx}"): st.session_state.edit_id = f"s_{idx}"; st.rerun()
                    with c_del:
                        if st.button("🗑", key=f"dl_s_{idx}"): st.session_state.del_id = f"s_{idx}"; st.rerun()

                    if st.session_state.edit_id == f"s_{idx}":
                        st.markdown("<div class='edit-box'>", unsafe_allow_html=True)
                        es = st.date_input("開始", value=row['start_date'], key=f"u_s_{idx}")
                        ee = st.date_input("終了", value=row['end_date'], key=f"u_e_{idx}")
                        eu = st.text_input("URL", value=row['post_url'], key=f"u_u_{idx}")
                        if st.button("更新", key=f"cf_s_{idx}"):
                            schedule_df.loc[idx, ['start_date', 'end_date', 'post_url']] = [es.isoformat(), ee.isoformat(), eu]
                            conn.update(worksheet="schedules", data=schedule_df); st.session_state.edit_id = None; st.rerun()
                        st.markdown("</div>", unsafe_allow_html=True)

                    if st.session_state.del_id == f"s_{idx}":
                        if st.button("🚨 削除確定", key=f"rl_dl_s_{idx}"):
                            conn.update(worksheet="schedules", data=schedule_df.drop(idx)); st.session_state.del_id = None; st.rerun()

# ==========================================
# Tab 2: My Gym
# ==========================================
with tab2:
    with st.expander("＋ ジムを登録", expanded=False):
        with st.form("m_form", clear_on_submit=True):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True)); st.rerun()

    if not master_df.empty:
        for gym_name in sorted_gyms:
            row_idx = master_df[master_df['gym_name'] == gym_name].index[0]
            row = master_df.loc[row_idx]
            with st.container(border=True):
                c_txt, c_ins, c_edit, c_del = st.columns([7, 1.2, 1.2, 1.2])
                with c_txt: st.markdown(f"### {row['gym_name']}")
                with c_ins: st.link_button("📸", row['profile_url'])
                with c_edit:
                    if st.button("✎", key=f"ed_g_{row_idx}"): st.session_state.edit_id = f"g_{row_idx}"; st.rerun()
                with c_del:
                    if st.button("🗑", key=f"dl_g_{row_idx}"): st.session_state.del_id = f"g_{row_idx}"; st.rerun()

                if st.session_state.edit_id == f"g_{row_idx}":
                    st.markdown("<div class='edit-box'>", unsafe_allow_html=True)
                    gn = st.text_input("名称", value=row['gym_name'], key=f"u_gn_{row_idx}")
                    gu = st.text_input("URL", value=row['profile_url'], key=f"u_gu_{row_idx}")
                    if st.button("保存", key=f"cf_g_{row_idx}"):
                        master_df.loc[row_idx, ['gym_name', 'profile_url']] = [gn, gu]
                        schedule_df.loc[schedule_df['gym_name'] == row['gym_name'], 'gym_name'] = gn
                        conn.update(worksheet="gym_master", data=master_df)
                        conn.update(worksheet="schedules", data=schedule_df)
                        st.session_state.edit_id = None; st.rerun()
                    st.markdown("</div>", unsafe_allow_html=True)

                if st.session_state.del_id == f"g_{row_idx}":
                    if st.button("🚨 全データ削除", key=f"rl_dl_g_{row_idx}"):
                        conn.update(worksheet="gym_master", data=master_df.drop(row_idx))
                        conn.update(worksheet="schedules", data=schedule_df[schedule_df['gym_name'] != row['gym_name']])
                        st.session_state.del_id = None; st.rerun()
