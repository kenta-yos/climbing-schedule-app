import streamlit as st
from st_gsheets_connection import GSheetsConnection

st.set_page_config(page_title="ボルダリングセット情報", layout="wide")

st.title("🧗‍♂️ ボルダリングルートセット管理")

# Google Sheetsへの接続
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read()

# スケジュール表示
st.subheader("📅 現在のスケジュール")
st.dataframe(df, use_container_width=True)

# 簡易登録フォーム（あなた専用）
with st.expander("➕ 新しい予定を登録する"):
    with st.form("add_form"):
        gym = st.text_input("ジム名")
        date = st.date_input("セット日")
        note = st.text_input("備考（4F、全面など）")
        url = st.text_input("Instagram URL")
        
        if st.form_submit_button("保存（※スプレッドシートに反映）"):
            # ここでデータ追加処理（後述のSecrets設定が必要）
            st.info("スプレッドシートに直接書き込むか、手動でスプレッドシートに追記してください")
