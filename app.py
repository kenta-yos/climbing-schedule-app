import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- カスタムCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif; background-color: #F8F9FA; }
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important; border-radius: 12px !important; padding: 1.2rem !important;
        background-color: white !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        margin-bottom: 1rem !important;
    }
    .past-event { opacity: 0.5; filter: grayscale(1); }
    h1 { font-size: 1.6rem !important; font-weight: 700 !important; }
    h3 { font-size: 1.1rem !important; font-weight: 600 !important; margin: 0 !important; }
    .date-text { font-size: 0.95rem; font-weight: 700; color: #555; margin-bottom: 0.5rem; }
    </style>
    """, unsafe_allow_html=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)

# シート名を指定して読み込み
# ※スプシ側のタブ名を正確に合わせてください
try:
    master_df = conn.read(worksheet="gym_master", ttl=0)
    schedule_df = conn.read(worksheet="schedules", ttl=0)
except:
    st.error("シート名が見つかりません。'gym_master' と 'schedules' という名前でシートを作成してください。")
    st.stop()

# よく行く順の計算（スケジュール登録数から）
gym_usage = schedule_df['gym_name'].value_counts() if not schedule_df.empty else pd.Series()
sorted_gyms = sorted(master_df['gym_name'].tolist(), key=lambda x: gym_usage.get(x, 0), reverse=True) if not master_df.empty else []

# --- タブ切り替え ---
tab1, tab2 = st.tabs(["🗓 スケジュール", "🔍 マイジム管理"])

# ==========================================
# Tab 1: スケジュール管理
# ==========================================
with tab1:
    st.title("🧗‍♂️ セットスケジュール")
    
    with st.expander("＋ 登録", expanded=False):
        if not sorted_gyms:
            st.warning("先にマイジムを登録してください")
        else:
            with st.form("add_schedule_form", clear_on_submit=True):
                selected_gym = st.selectbox("ジムを選択", options=["(選択してください)"] + sorted_gyms)
                post_url = st.text_input("今回の投稿URL")
                
                if 'date_count' not in st.session_state: st.session_state.date_count = 1
                for i in range(st.session_state.date_count):
                    st.write(f"日程 {i+1}")
                    c1, c2 = st.columns(2)
                    with c1: st.date_input("開始", key=f"s_{i}")
                    with c2: st.date_input("終了", key=f"e_{i}")
                
                if st.form_submit_button("予定を保存"):
                    if selected_gym != "(選択してください)" and post_url:
                        new_data = []
                        for i in range(st.session_state.date_count):
                            new_data.append({
                                "gym_name": selected_gym,
                                "start_date": st.session_state[f"s_{i}"].isoformat(),
                                "end_date": st.session_state[f"e_{i}"].isoformat(),
                                "post_url": post_url
                            })
                        updated_sched = pd.concat([schedule_df, pd.DataFrame(new_data)], ignore_index=True)
                        conn.update(worksheet="schedules", data=updated_sched)
                        st.session_state.date_count = 1
                        st.success("保存完了！")
                        st.rerun()

            if st.session_state.date_count < 5:
                if st.button("＋ 日程を追加"):
                    st.session_state.date_count += 1
                    st.rerun()

    # 表示ロジック（以下、前回の月別表示と同様）
    if not schedule_df.empty:
        # (日付型への変換やフィルタリング処理をここに記述...前回のコードと同様)
        st.write("※ここにカレンダー/リスト表示")
        # （紙面の都合上省略しますが、前回のタイムライン表示コードをここに統合します）

# ==========================================
# Tab 2: マイジム管理
# ==========================================
with tab2:
    st.title("🔍 マイジム管理")
    with st.expander("＋ 新規ジム登録"):
        with st.form("master_form", clear_on_submit=True):
            name = st.text_input("ジム名")
            url = st.text_input("プロフィールURL")
            if st.form_submit_button("マスター登録"):
                if name and url:
                    new_m = pd.concat([master_df, pd.DataFrame([{"gym_name": name, "profile_url": url}])], ignore_index=True)
                    conn.update(worksheet="gym_master", data=new_m)
                    st.success("登録しました")
                    st.rerun()
    
    # マイジム一覧表示
    if not master_df.empty:
        for gym in sorted_gyms:
            row = master_df[master_df['gym_name'] == gym].iloc[0]
            with st.container(border=True):
                c1, c2 = st.columns([2, 1])
                with c1: st.markdown(f"### {row['gym_name']}")
                with c2: st.link_button("プロフ", row['profile_url'], use_container_width=True)
