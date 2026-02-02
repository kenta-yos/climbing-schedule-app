import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

# ページ設定：中央寄せでスッキリ見せる
st.set_page_config(page_title="Bouldering Timeline", layout="centered")

# --- カスタムCSSでデザインを磨き上げる ---
st.markdown("""
    <style>
    /* 全体のフォントをスッキリさせる */
    .stApp {
        background-color: #fcfcfc;
    }
    /* カードのデザイン */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: 1px solid #eee !important;
        border-radius: 12px !important;
        padding: 1.5rem !important;
        background-color: white !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        margin-bottom: 1rem !important;
    }
    /* タイトルなどの調整 */
    h1 {
        font-weight: 700 !important;
        color: #1A1A1A !important;
        letter-spacing: -0.02em;
    }
    h3 {
        font-size: 1.2rem !important;
        font-weight: 600 !important;
        margin-bottom: 0 !important;
    }
    .date-label {
        font-size: 0.85rem;
        color: #666;
        font-weight: 500;
        margin-bottom: 0.2rem;
    }
    </style>
    """, unsafe_allow_stdio=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ Timeline")

# --- 登録セクション（より控えめに） ---
with st.expander("＋ Add Schedule", expanded=False):
    with st.form("simple_add_form", clear_on_submit=True):
        gym_name = st.text_input("Gym Name")
        col1, col2 = st.columns(2)
        with col1: start_d = st.date_input("Start")
        with col2: end_d = st.date_input("End")
        insta_url = st.text_input("Instagram URL")
        
        if st.form_submit_button("Submit"):
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
                st.success("Updated.")
                st.rerun()

# --- タイムライン表示 ---
if df.empty:
    st.info("No upcoming sets.")
else:
    df['date'] = pd.to_datetime(df['date'])
    df['end_date'] = pd.to_datetime(df['end_date'])
    today = pd.to_datetime(datetime.now().date())
    display_df = df[df['end_date'] >= today].sort_values('date')

    st.write("") # スペース

    for _, row in display_df.iterrows():
        # 期間のフォーマット
        period = f"{row['date'].strftime('%m.%d')} - {row['end_date'].strftime('%m.%d')}"
        
        with st.container(border=True):
            # 日付ラベルを小さく上に配置
            st.markdown(f"<div class='date-label'>📅 {period}</div>", unsafe_allow_html=True)
            
            col_info, col_link = st.columns([3, 1])
            with col_info:
                st.markdown(f"### {row['gym_name']}")
            with col_link:
                if row['url']:
                    # ボタンを少し小さく、右寄せに配置
                    st.link_button("Details", row['url'], use_container_width=True)
