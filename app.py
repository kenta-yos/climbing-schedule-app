import streamlit as st
from streamlit_gsheets import GSheetsConnection
from streamlit_calendar import calendar
import pandas as pd

st.set_page_config(page_title="都内ボルダリングセット情報", layout="wide")

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)

# データの読み込み（キャッシュを無効化して最新を取得）
df = conn.read(ttl=0)

st.title("🧗‍♂️ ボルダリングセット・マスター")

# --- 登録セクション ---
with st.expander("🆕 新しいセット予定を登録する（複数同時OK）", expanded=False):
    with st.form("bulk_add_form"):
        gym_name = st.text_input("ジム名", placeholder="例: B-PUMP 荻窪")
        insta_url = st.text_input("Instagram URL", placeholder="紙飛行機アイコンからリンクをコピー")
        
        st.write("---")
        st.write("▼ セット箇所の詳細（複数ある場合は以下に入力）")
        
        # 3つまでのエリアを一度に登録できるように設計
        entries = []
        cols = st.columns(3)
        for i in range(3):
            with cols[i]:
                st.markdown(f"**箇所 {i+1}**")
                wall_name = st.text_input(f"壁の名前 {i+1}", key=f"wall_{i}")
                start_date = st.date_input(f"開始日 {i+1}", key=f"start_{i}")
                end_date = st.date_input(f"終了日 {i+1}", key=f"end_{i}")
                if wall_name:
                    entries.append({
                        "gym_name": gym_name,
                        "date": start_date, # カレンダー表示用
                        "end_date": end_date,
                        "wall": wall_name,
                        "url": insta_url
                    })

        if st.form_submit_button("スプレッドシートに一括保存"):
            if gym_name and entries:
                # 既存データに結合
                new_data = pd.DataFrame(entries)
                updated_df = pd.concat([df, new_data], ignore_index=True)
                # スプレッドシートを更新
                conn.update(data=updated_df)
                st.success(f"{len(entries)}件の予定を保存しました！再読み込みしてください。")
                st.rerun()
            else:
                st.error("ジム名と少なくとも1つの壁情報を入力してください。")

# --- カレンダー表示セクション ---
st.subheader("🗓 セットスケジュールカレンダー")

# カレンダー用イベントデータの作成
calendar_events = []
if not df.empty:
    for _, row in df.iterrows():
        calendar_events.append({
            "title": f"🛠{row['gym_name']} ({row['wall']})",
            "start": str(row['date']),
            "end": str(row['end_date']),
            "url": row['url'], # クリック時に遷移
            "color": "#FF4B4B" if "B-PUMP" in str(row['gym_name']) else "#3D3333" # ジム名で色分け（例）
        })

# カレンダーの設定
calendar_options = {
    "headerToolbar": {
        "left": "prev,next today",
        "center": "title",
        "right": "dayGridMonth,timeGridWeek",
    },
    "initialView": "dayGridMonth",
    "selectable": True,
}

# カレンダーの描画
state = calendar(events=calendar_events, options=calendar_options, key="climbing_cal")

# クリック時の動作説明
st.caption("💡 カレンダー上の予定をクリックすると、そのジムのInstagram投稿が開きます。")

# --- データ一覧（デバッグ・削除用） ---
with st.expander("📝 登録データ一覧・確認"):
    st.dataframe(df, use_container_width=True)
