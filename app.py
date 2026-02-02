import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極の洗練UI CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #FFFFFF; }

    /* --- タイムライン（セットスケジュール用） --- */
    .timeline-wrapper {
        position: relative;
        padding-left: 0px; /* 左端をコンテナに合わせる */
        margin: 25px 0;
    }

    /* 縦線：コンテナの左端から少し右(5px)に配置 */
    .timeline-line {
        position: absolute;
        left: 5px;
        top: 0;
        bottom: 0;
        width: 1px;
        background-color: #EEEEEE;
        z-index: 1;
    }

    .timeline-item {
        position: relative;
        display: flex;
        align-items: center;
        padding: 12px 0 12px 25px; /* 線を避けて右側にテキストを配置 */
        text-decoration: none !important;
        z-index: 2;
    }

    /* ドット：線の真上に配置 */
    .timeline-dot {
        position: absolute;
        left: 0px; 
        width: 11px;
        height: 11px;
        background-color: #B22222; /* 落ち着いた赤 */
        border-radius: 50%;
        border: 2px solid #FFFFFF;
        box-shadow: 0 0 0 1px #EEEEEE;
    }

    .time-date {
        color: #B22222;
        font-weight: 700;
        font-size: 0.9rem;
        width: 90px;
        flex-shrink: 0;
    }

    .time-gym {
        color: #1A1A1A;
        font-weight: 500;
        font-size: 1rem;
    }

    /* --- ジム一覧（シンプルカード） --- */
    .gym-card {
        display: block;
        padding: 14px 18px;
        margin-bottom: 8px;
        background-color: #F8F9FA;
        border-radius: 8px;
        text-decoration: none !important;
        color: #1A1A1A !important;
        font-weight: 500;
        border: 1px solid #F1F3F5;
        transition: background 0.2s;
    }
    .gym-card:hover { background-color: #E9ECEF; }

    /* 共通設定 */
    .past-item { opacity: 0.4; }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    return (conn.read(worksheet="gym_master", ttl=0), 
            conn.read(worksheet="schedules", ttl=0), 
            conn.read(worksheet="climbing_logs", ttl=0))

master_df, schedule_df, log_df = load_all_data()
sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

tab1, tab2, tab3 = st.tabs(["セットスケジュール", "ログ", "ジム"])

# ==========================================
# Tab 1: セットスケジュール（洗練タイムライン）
# ==========================================
with tab1:
    with st.expander("＋ スケジュールを登録"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            for i in range(st.session_state.get('date_count', 1)):
                c1, c2 = st.columns(2)
                with c1: st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                with c2: st.date_input(f"終了 {i+1}", value=datetime.now().date(), key=f"e_date_{i}")
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)" and p_url:
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{i}"].isoformat(), "end_date": st.session_state[f"e_date_{i}"].isoformat(), "post_url": p_url} for i in range(st.session_state.get('date_count', 1))]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.session_state.date_count = 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        
        cur_m = datetime.now().strftime('%Y年%m月')
        all_m = sorted(s_df['month_year'].unique().tolist())
        sel_m = st.selectbox("表示月", options=all_m, index=all_m.index(cur_m) if cur_m in all_m else 0)
        
        m_df = s_df[s_df['month_year'] == sel_m].copy()
        m_df['is_past'] = m_df['end_date'].dt.date < datetime.now().date()
        
        st.markdown('<div class="timeline-wrapper"><div class="timeline-line"></div>', unsafe_allow_html=True)
        for _, row in m_df.sort_values(['is_past', 'start_date']).iterrows():
            d_s, d_e = row['start_date'].strftime('%m/%d'), row['end_date'].strftime('%m/%d')
            d_display = d_s if d_s == d_e else f"{d_s}-{d_e}"
            past_cls = "past-item" if row['is_past'] else ""
            
            st.markdown(f"""
                <a href="{row['post_url']}" target="_blank" class="timeline-item {past_cls}">
                    <div class="timeline-dot"></div>
                    <span class="time-date">{d_display}</span>
                    <span class="time-gym">{row['gym_name']}</span>
                </a>
            """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム（元通りのシンプルカード）
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True)); st.rerun()

    st.write("") # スペース
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f'<a href="{url}" target="_blank" class="gym-card">{gym}</a>', unsafe_allow_html=True)
