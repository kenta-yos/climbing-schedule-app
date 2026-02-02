import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="ボルダリングセット速報", layout="centered")

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ セットスケジュール")

# --- 登録セクション（極限までシンプルに） ---
with st.expander("🆕 予定を登録", expanded=False):
    with st.form("simple_add_form"):
        gym_name = st.text_input("ジム名", placeholder="例: B-PUMP 荻窪")
        col1, col2 = st.columns(2)
        with col1: start_d = st.date_input("セット開始日")
        with col2: end_d = st.date_input("セット終了日")
        insta_url = st.text_input("Instagram URL")
        
        if st.form_submit_button("保存"):
            if gym_name and insta_url:
                new_entry = pd.DataFrame([{
                    "gym_name": gym_name, 
                    "date": start_d.isoformat(), 
                    "end_date": end_d.isoformat(), 
                    "url": insta_url,
                    "wall": "" # 互換性のために残す（空文字）
                }])
                updated_df = pd.concat([df, new_entry], ignore_index=True)
                conn.update(data=updated_df)
                st.success("保存完了！")
                st.rerun()

# --- タイムライン表示セクション ---
if df.empty:
    st.info("予定が登録されていません。")
else:
    # データを日付順に整理
    df['date'] = pd.to_datetime(df['date'])
    df['end_date'] = pd.to_datetime(df['end_date'])
    
    # 今日以降の予定をソート
    today = pd.to_datetime(datetime.now().date())
    display_df = df[df['end_date'] >= today].sort_values('date')

    st.subheader("📅 直近のセット予定")

    for _, row in display_df.iterrows():
        # 日付と曜日のフォーマット（期間表示）
        start_str = row['date'].strftime('%m/%d (%a)')
        end_str = row['end_date'].strftime('%m/%d (%a)')
        
        with st.container(border=True):
            # 期間を大きく表示
            st.markdown(f"#### 🗓️ {start_str} 〜 {end_str}")
            
            col_info, col_link = st.columns([3, 1])
            with col_info:
                # ジム名を強調
                st.markdown(f"### {row['gym_name']}")
            with col_link:
                if row['url']:
                    st.link_button("インスタで確認", row['url'], use_container_width=True)
