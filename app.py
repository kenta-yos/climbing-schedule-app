import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="ボルダリングセット・タイムライン", layout="centered")

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ セットスケジュール")

# --- 登録セクション（折りたたみ） ---
with st.expander("🆕 新しい予定を登録"):
    with st.form("add_form"):
        gym_name = st.text_input("ジム名")
        insta_url = st.text_input("Instagram URL")
        st.write("---")
        entries = []
        for i in range(2): # 1度の登録は2件までに簡略化
            wall = st.text_input(f"壁名 {i+1}", key=f"w_{i}")
            col1, col2 = st.columns(2)
            with col1: start_d = st.date_input(f"開始 {i+1}", key=f"s_{i}")
            with col2: end_d = st.date_input(f"終了 {i+1}", key=f"e_{i}")
            if wall:
                entries.append({"gym_name": gym_name, "date": start_d, "end_date": end_d, "wall": wall, "url": insta_url})
        
        if st.form_submit_button("保存"):
            if gym_name and entries:
                new_df = pd.concat([df, pd.DataFrame(entries)], ignore_index=True)
                conn.update(data=new_df)
                st.success("保存しました！")
                st.rerun()

# --- タイムライン表示セクション ---
if df.empty:
    st.info("予定が登録されていません。")
else:
    # データを日付順に整理
    df['date'] = pd.to_datetime(df['date'])
    df['end_date'] = pd.to_datetime(df['end_date'])
    
    # 今月以降のデータに絞り込み、日付順にソート
    today = pd.to_datetime(datetime.now().date())
    display_df = df[df['end_date'] >= today].sort_values('date')

    st.subheader(f"📅 {datetime.now().month}月のセット予定")

    # 日付ごとにグループ化して表示
    for date, group in display_df.groupby('date'):
        # 日付の見出し
        date_str = date.strftime('%m/%d (%a)')
        st.markdown(f"#### 🗓️ {date_str}")
        
        for _, row in group.iterrows():
            # カード形式のUI
            with st.container(border=True):
                col_info, col_link = st.columns([4, 1])
                
                with col_info:
                    # ステータスバッジ
                    if row['date'] == today:
                        st.markdown("🔴 **TODAY SET**")
                    
                    st.markdown(f"### {row['gym_name']}")
                    st.markdown(f"**📍 {row['wall']}**")
                    
                    # 期間表示
                    period = f"{row['date'].strftime('%m/%d')} 〜 {row['end_date'].strftime('%m/%d')}"
                    st.caption(f"⏱️ 期間: {period}")

                with col_link:
                    if row['url']:
                        st.link_button("見る", row['url'], use_container_width=True)
        st.write("") # スペース空け
