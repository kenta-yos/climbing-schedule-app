import streamlit as st
from streamlit_gsheets import GSheetsConnection
from streamlit_calendar import calendar
import pandas as pd

# 1. ページ設定
st.set_page_config(page_title="ボルダリングセット管理", layout="wide")

# 2. スプレッドシート接続
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ ボルダリングセット・マスター")

# --- 3. 登録セクション ---
with st.expander("🆕 新しいセット予定を登録する", expanded=False):
    with st.form("bulk_add_form"):
        gym_name = st.text_input("ジム名", placeholder="例: B-PUMP 荻窪")
        insta_url = st.text_input("Instagram URL")
        
        st.write("---")
        entries = []
        cols = st.columns(3)
        for i in range(3):
            with cols[i]:
                st.markdown(f"**箇所 {i+1}**")
                wall_name = st.text_input(f"壁名 {i+1}", key=f"wall_{i}")
                start_d = st.date_input(f"開始日 {i+1}", key=f"start_{i}")
                end_d = st.date_input(f"終了日 {i+1}", key=f"end_{i}")
                if wall_name:
                    entries.append({
                        "gym_name": gym_name,
                        "date": start_d.isoformat(),
                        "end_date": end_d.isoformat(),
                        "wall": wall_name,
                        "url": insta_url
                    })

        if st.form_submit_button("保存"):
            if gym_name and entries:
                new_df = pd.DataFrame(entries)
                updated_df = pd.concat([df, new_df], ignore_index=True)
                conn.update(data=updated_df)
                st.success("保存完了！")
                st.rerun()

# --- 4. カレンダー表示セクション ---
st.subheader("🗓 セットスケジュールカレンダー")

calendar_events = []
if not df.empty:
    for i, row in df.iterrows():
        calendar_events.append({
            "id": i,
            "title": f"🛠{row['gym_name']} ({row['wall']})",
            "start": str(row['date']),
            "end": str(row['end_date']),
            # URLはここでは渡さず、クリックイベントで取得します
            "extendedProps": {"url": str(row['url'])}
        })

calendar_options = {
    "headerToolbar": {"left": "prev,next today", "center": "title", "right": "dayGridMonth"},
    "initialView": "dayGridMonth",
    "selectable": True,
}

# カレンダーの描画
state = calendar(events=calendar_events, options=calendar_options, key="climbing_cal")

# --- 5. インスタへ飛ばすための「ボタン」を表示 ---
# カレンダー内の予定がクリックされたら、その下にURLを表示する（これが最も確実で安全です）
if state.get("eventClick"):
    event_data = state["eventClick"]["event"]
    url = event_data.get("extendedProps", {}).get("url")
    
    st.divider()
    st.markdown(f"### 🚩 選択中の予定: {event_data['title']}")
    if url and url.startswith("http"):
        st.link_button("🔗 このセットのInstagram投稿を開く", url, type="primary")
    else:
        st.warning("この予定にはURLが登録されていません。")

# --- 6. データ管理 ---
with st.expander("📝 登録データ一覧"):
    st.dataframe(df, use_container_width=True)
