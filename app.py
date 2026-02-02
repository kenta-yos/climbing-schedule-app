# --- カレンダー表示セクション ---
st.subheader("🗓 セットスケジュールカレンダー")

calendar_events = []
if not df.empty:
    for _, row in df.iterrows():
        # 文字列として確実に扱う
        url = str(row['url']) if pd.notnull(row['url']) else ""
        
        calendar_events.append({
            "title": f"🛠{row['gym_name']} ({row['wall']})",
            "start": str(row['date']),
            "end": str(row['end_date']),
            "url": url, # ここにURLを入れる
            "color": "#FF4B4B" if "B-PUMP" in str(row['gym_name']) else "#3D3333"
        })

calendar_options = {
    "headerToolbar": {
        "left": "prev,next today",
        "center": "title",
        "right": "dayGridMonth,timeGridWeek",
    },
    "initialView": "dayGridMonth",
    "selectable": True,
    "editable": False,
    # ↓ここが重要：クリックした時にURLを別タブで開く設定
    "eventClick": """
        function(info) {
            if (info.event.url) {
                window.open(info.event.url, '_blank');
                info.jsEvent.preventDefault(); // デフォルトの挙動を阻止
            }
        }
    """,
}

# カレンダーを表示
# 注意：streamlit-calendarのバージョンによってはカスタムJSが動かない場合があります。
# そのためのバックアップ策を下に用意します。
state = calendar(events=calendar_events, options=calendar_options, key="climbing_cal")

# --- バックアップ策：クリックした予定の詳細を下に表示する ---
if state.get("eventClick"):
    clicked_event = state["eventClick"]["event"]
    st.info(f"選択中: {clicked_event['title']}")
    if clicked_event.get("url"):
        st.link_button("👉 Instagramで投稿を見る", clicked_event["url"])
