import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd

st.set_page_config(page_title="都内ボルダリングセット情報", layout="wide")

st.title("🧗‍♂️ ボルダリングルートセット統合カレンダー")

# --- 1. Google Sheets への接続 (無料) ---
# ※実際には .streamlit/secrets.toml に設定が必要
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read()

# --- 2. スケジュール入力セクション ---
with st.sidebar:
    st.header("新着情報の登録")
    with st.form("set_form"):
        gym_name = st.selectbox("ジム名", ["B-PUMP Ogikubo", "Rocky 品川", "PEKIPEKI 渋谷"])
        set_date = st.date_input("セット日")
        description = st.text_input("内容 (例: 4F 奥壁)")
        insta_url = st.text_input("Instagram URL")
        
        if st.form_submit_button("登録"):
            # ここでスプレッドシートに保存する処理
            st.success(f"{gym_name}の予定を登録しました！")

# --- 3. カレンダー・リスト表示 ---
st.subheader("セットスケジュール一覧")
if not df.empty:
    # 日付順に並び替え
    df['date'] = pd.to_datetime(df['date'])
    st.dataframe(df.sort_values('date'), use_container_width=True)
    
    # インスタ埋め込み表示（URLがある場合）
    st.divider()
    st.subheader("詳細確認 (Instagram)")
    for index, row in df.iterrows():
        with st.expander(f"{row['date'].strftime('%m/%d')} : {row['gym_name']}"):
            st.write(f"内容: {row['description']}")
            # インスタの投稿を表示させるリンク
            st.markdown(f"[Instagramで投稿を見る]({row['insta_url']})")
