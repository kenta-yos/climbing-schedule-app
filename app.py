import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

# ページ設定：スマホで見やすいよう幅を制限
st.set_page_config(page_title="Bouldering Timeline", layout="centered")

# --- カスタムCSS（デザインの微調整） ---
st.markdown("""
    <style>
    /* フォントと背景 */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
        background-color: #F8F9FA;
    }
    /* カードのデザイン：枠線を消し、柔らかい影をつける */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important;
        border-radius: 16px !important;
        padding: 1.2rem !important;
        background-color: white !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        margin-bottom: 1.2rem !important;
    }
    /* タイトル：少し小さくしてモダンに */
    h1 {
        font-size: 1.8rem !important;
        font-weight: 700 !important;
        letter-spacing: -0.03em !important;
        padding: 1rem 0 !important;
    }
    h3 {
        font-size: 1.1rem !important;
        font-weight: 600 !important;
        color: #1A1A1A;
    }
    /* 日付ラベル */
    .date-badge {
        font-size: 0.75rem;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.4rem;
    }
    /* ボタンのカスタマイズ */
    .stButton>button {
        border-radius: 8px !important;
        font-weight: 600 !important;
        border: none !important;
        background-color: #F0F2F6 !important;
        color: #1A1A1A !important;
    }
    .stButton>button:hover {
        background-color: #E0E4E9 !important;
    }
    </style>
    """, unsafe_allow_html=True) # 引数を修正しました

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ Timeline")

# --- 登録セクション ---
with st.expander("＋ Add New", expanded=False):
    with st.form("simple_add_form", clear_on_submit=True):
        gym_name = st.text_input("Gym Name")
        col1, col2 = st.columns(2)
        with col1: start_d = st.date_input("Start")
        with col2: end_d = st.date_input("End")
        insta_url = st.text_input("Instagram URL")
        
        if st.form_submit_button("Save Schedule"):
            if gym_name and insta_url:
                new_entry = pd.DataFrame([{
                    "gym_name": gym_name, 
                    "date": start_d.isoformat(), 
                    "end_date": end_d.isoformat(), 
                    "url": insta_url,
                    "wall": ""
                }])
                updated_df = pd.concat([df, new_entry], ignore_index=True)
                conn.update(data=updated_df)
                st.success("Successfully saved.")
                st.rerun()

# --- タイムライン表示 ---
if df.empty:
    st.info("No schedules found.")
else:
    # データ整形
    df['date'] = pd.to_datetime(df['date'])
    df['end_date'] = pd.to_datetime(df['end_date'])
    today = pd.to_datetime(datetime.now().date())
    
    # 今日以降の予定をソート
    display_df = df[df['end_date'] >= today].sort_values('date')

    st.write("") # スペース

    for _, row in display_df.iterrows():
        # 02.09 - 02.11 の形式
        period = f"{row['date'].strftime('%m.%d')} — {row['end_date'].strftime('%m.%d')}"
        
        with st.container(border=True):
            # 日付バッジ
            st.markdown(f"<div class='date-badge'>{period}</div>", unsafe_allow_html=True)
            
            col_info, col_link = st.columns([2, 1])
            with col_info:
                st.markdown(f"### {row['gym_name']}")
            with col_link:
                if row['url']:
                    st.link_button("Details", row['url'], use_container_width=True)

