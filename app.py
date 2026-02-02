import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 1. スタイルの定義（ここがデザインの肝） ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    
    /* 全体の背景とフォント */
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #F0F2F5; }

    /* カードデザイン */
    .custom-card {
        background-color: white !important;
        border-radius: 12px !important;
        padding: 16px !important;
        margin-bottom: 12px !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        border-left: 6px solid #2E7D32 !important;
        display: block !important;
        text-decoration: none !important;
        color: inherit !important;
        transition: transform 0.1s ease-in-out;
    }
    .custom-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; }
    .custom-card:active { transform: scale(0.98); }

    /* 日程バッジ（目立たせる） */
    .date-badge {
        display: inline-block !important;
        background-color: #E8F5E9 !important;
        color: #2E7D32 !important;
        padding: 4px 12px !important;
        border-radius: 8px !important;
        font-size: 1.1rem !important;
        font-weight: 700 !important;
        margin-bottom: 8px !important;
    }

    /* ジム名 */
    .gym-name-text {
        font-size: 1.2rem !important;
        font-weight: 700 !important;
        color: #1C1E21 !important;
        margin: 0 !important;
    }

    /* 終了済みスタイル */
    .past-card {
        border-left-color: #9E9E9E !important;
        opacity: 0.6 !important;
        filter: grayscale(0.5) !important;
    }
    .status-badge {
        float: right;
        background: #EEE;
        color: #666;
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: normal;
    }
    </style>
    """, unsafe_allow_html=True)

# --- 2. データ処理 ---
conn = st.connection("gsheets", type=GSheetsConnection)
master_df = conn.read(worksheet="gym_master", ttl=0)
schedule_df = conn.read(worksheet="schedules", ttl=0)

if 'date_count' not in st.session_state: st.session_state.date_count = 1
for i in range(5):
    if f's_date_{i}' not in st.session_state: st.session_state[f's_date_{i}'] = datetime.now().date()

sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

tab1, tab2 = st.tabs(["🗓 セットスケジュール", "🔍 よく行くジム"])

# --- 3. タブ1: セットスケジュール ---
with tab1:
    with st.expander("＋ 新規予定を追加"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            for i in range(st.session_state.date_count):
                c1, c2 = st.columns(2)
                with c1: st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                with c2: st.date_input(f"終了 {i+1}", value=st.session_state[f"s_date_{i}"], key=f"e_date_{i}")
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)" and p_url:
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{i}"].isoformat(), 
                                 "end_date": st.session_state[f"e_date_{i}"].isoformat(), "post_url": p_url} for i in range(st.session_state.date_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.session_state.date_count = 1
                    st.rerun()
        if st.session_state.date_count < 5:
            if st.button("＋ 日程枠を増やす"):
                st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        
        cur_m = datetime.now().strftime('%Y年%m月')
        all_months = sorted(s_df['month_year'].unique().tolist())
        sel_m = st.selectbox("月", options=all_months, index=all_months.index(cur_m) if cur_m in all_months else 0)

        month_df = s_df[s_df['month_year'] == sel_m].copy()
        month_df['is_past'] = month_df['end_date'].dt.date < datetime.now().date()
        month_df = month_df.sort_values(by=['is_past', 'start_date'])

        # ここで一気にHTMLを構築して出力
        for _, row in month_df.iterrows():
            past_class = "past-card" if row['is_past'] else ""
            status_html = "<span class='status-badge'>終了済</span>" if row['is_past'] else ""
            
            # st.markdownで unsafe_allow_html=True を使い、各カードを独立したHTMLとして描画
            card_html = f"""
            <a href="{row['post_url']}" target="_blank" class="custom-card {past_class}">
                <div class="date-badge">🗓 {row['start_date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}</div>
                {status_html}
                <div class="gym-name-text">{row['gym_name']}</div>
            </a>
            """
            st.markdown(card_html, unsafe_allow_html=True)

# --- 4. タブ2: よく行くジム ---
with tab2:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_form"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.rerun()

    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f"""
            <a href="{url}" target="_blank" class="custom-card">
                <div class="gym-name-text">🔍 {gym}</div>
            </a>
            """, unsafe_allow_html=True)
