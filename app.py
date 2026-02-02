import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- タイムライン・精密レイアウトCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #FFFFFF; }

    /* タイムライン全体のコンテナ */
    .timeline-wrapper {
        position: relative;
        padding-left: 40px; /* 線と点のスペース */
        margin: 20px 0;
    }

    /* 垂直な線：wrapperの左端に固定 */
    .timeline-line {
        position: absolute;
        left: 20px;
        top: 0;
        bottom: 0;
        width: 1px;
        background-color: #E0E0E0;
        z-index: 1;
    }

    /* 各アイテム */
    .timeline-item {
        position: relative;
        display: flex;
        align-items: center;
        padding: 15px 0;
        text-decoration: none !important;
        border: none !important;
        z-index: 2;
    }

    /* 精密に配置されたドット */
    .timeline-dot {
        position: absolute;
        left: -24.5px; /* 線の位置(20px)に合わせて調整 */
        width: 10px;
        height: 10px;
        background-color: #B22222;
        border-radius: 50%;
        border: 2px solid #FFFFFF;
        box-shadow: 0 0 0 1px #E0E0E0;
    }

    /* 日付：落ち着いた赤 */
    .time-date {
        color: #B22222;
        font-weight: 700;
        font-size: 0.9rem;
        width: 90px;
        flex-shrink: 0;
    }

    /* ジム名：黒、1行固定 */
    .time-gym {
        color: #1A1A1A;
        font-weight: 500;
        font-size: 1.05rem;
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* 過去の予定：薄くする */
    .past-item { opacity: 0.4; }
    .past-item .timeline-dot { background-color: #999; }

    /* モバイル対応：文字が重ならないように */
    @media (max-width: 480px) {
        .time-date { width: 75px; font-size: 0.85rem; }
        .time-gym { font-size: 0.95rem; }
    }
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
# Tab 1: セットスケジュール
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
        
        # タイムライン描画
        st.markdown('<div class="timeline-wrapper"><div class="timeline-line"></div>', unsafe_allow_html=True)
        for _, row in m_df.sort_values(['is_past', 'start_date']).iterrows():
            d_s = row['start_date'].strftime('%m/%d')
            d_e = row['end_date'].strftime('%m/%d')
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
# Tab 2: ログ / Tab 3: ジム（同様のUIを適用）
# ==========================================
with tab2:
    # ... (ログ入力フォームは維持)
    if not log_df.empty:
        # ... (統計グラフなどは維持)
        st.markdown('<div class="timeline-wrapper"><div class="timeline-line"></div>', unsafe_allow_html=True)
        # 履歴をタイムライン表示
        st.markdown('</div>', unsafe_allow_html=True)

with tab3:
    # ... (ジム登録フォームは維持)
    st.markdown('<div class="timeline-wrapper"><div class="timeline-line"></div>', unsafe_allow_html=True)
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f'<a href="{url}" target="_blank" class="timeline-item"><div class="timeline-dot" style="background:#CCC;"></div><span class="time-gym" style="margin-left:90px;">{gym}</span></a>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)
