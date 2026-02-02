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
    /* 過去日程のグレーアウト */
    .past-event { opacity: 0.4; filter: grayscale(1); pointer-events: none; }
    h1 { font-size: 1.6rem !important; font-weight: 700 !important; margin-bottom: 1.5rem !important; }
    h3 { font-size: 1.1rem !important; font-weight: 600 !important; margin: 0 !important; }
    .date-text { font-size: 0.95rem; font-weight: 700; color: #555; margin-bottom: 0.5rem; }
    .status-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: #eee; color: #666; margin-left: 8px; }
    </style>
    """, unsafe_allow_html=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)

try:
    master_df = conn.read(worksheet="gym_master", ttl=0)
    schedule_df = conn.read(worksheet="schedules", ttl=0)
except Exception as e:
    st.error("シート名確認：'gym_master' と 'schedules' が必要です。")
    st.stop()

# よく行く順の計算
gym_usage = schedule_df['gym_name'].value_counts() if not schedule_df.empty else pd.Series()
sorted_gyms = sorted(master_df['gym_name'].tolist(), key=lambda x: gym_usage.get(x, 0), reverse=True) if not master_df.empty else []

# --- タブ切り替え ---
tab1, tab2 = st.tabs(["🗓 スケジュール", "🔍 よく行くジム"])

# ==========================================
# Tab 1: スケジュール管理
# ==========================================
with tab1:
    st.title("🧗‍♂️ セットスケジュール")
    
    with st.expander("＋ 登録", expanded=False):
        if not sorted_gyms:
            st.warning("先に「よく行くジム」タブからジムを登録してください")
        else:
            if 'date_count' not in st.session_state:
                st.session_state.date_count = 1

            with st.form("add_schedule_form", clear_on_submit=True):
                selected_gym = st.selectbox("ジムを選択", options=["(選択してください)"] + sorted_gyms)
                post_url = st.text_input("今回の投稿URL (Instagram)")
                
                date_inputs = []
                for i in range(st.session_state.date_count):
                    st.write(f"--- 日程 {i+1} ---")
                    c1, c2 = st.columns(2)
                    with c1: s_val = st.date_input(f"開始 {i+1}", key=f"start_in_{i}")
                    with c2: e_val = st.date_input(f"終了 {i+1}", key=f"end_in_{i}")
                    date_inputs.append((s_val, e_val))
                
                submitted = st.form_submit_button("予定を保存")

            # フォームのすぐ下に配置。リロードされるが、session_stateで数は保持される
            if st.session_state.date_count < 5:
                if st.button("＋ 日程を追加（入力枠を増やす）"):
                    st.session_state.date_count += 1
                    st.rerun()

            if submitted:
                if selected_gym != "(選択してください)" and post_url:
                    new_entries = []
                    for s, e in date_inputs:
                        new_entries.append({
                            "gym_name": selected_gym,
                            "start_date": s.isoformat(),
                            "end_date": e.isoformat(),
                            "post_url": post_url
                        })
                    updated_df = pd.concat([schedule_df, pd.DataFrame(new_entries)], ignore_index=True)
                    conn.update(worksheet="schedules", data=updated_df)
                    st.session_state.date_count = 1 # 保存後はリセット
                    st.success("保存しました！")
                    st.rerun()

    # --- タイムライン表示ロジック（ここを完全修正） ---
    current_month_str = datetime.now().strftime('%Y年%m月')
    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        today = pd.to_datetime(datetime.now().date())
        
        # 月情報の付与
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        all_months = sorted(s_df['month_year'].unique().tolist())
        if current_month_str not in all_months:
            all_months.append(current_month_str)
            all_months.sort()
        
        selected_month = st.selectbox("表示月を選択", options=all_months, index=all_months.index(current_month_str))
        
        # フィルタリング
        month_df = s_df[s_df['month_year'] == selected_month].copy()
        
        if not month_df.empty:
            # 1. 終了日が今日より前なら「過去」
            month_df['is_past'] = month_df['end_date'] < today
            
            # 2. 並び替え： [過去フラグ(Falseが先=0), 開始日] の順でソート
            # これにより「今日以降の予定が1日から順に並び、その後に過去分がまとまる」
            month_df = month_df.sort_values(by=['is_past', 'start_date'], ascending=[True, True])
            
            st.write("") # スペース
            
            for _, row in month_df.iterrows():
                period = f"{row['start_date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}"
                is_past = row['is_past']
                
                # HTMLクラスの切り替え
                past_class = "past-event" if is_past else ""
                st.markdown(f"<div class='{past_class}'>", unsafe_allow_html=True)
                
                with st.container(border=True):
                    # 日付表示
                    st.markdown(f"<div class='date-text'>🗓 {period}</div>", unsafe_allow_html=True)
                    
                    col_info, col_link = st.columns([2, 1])
                    with col_info:
                        gym_label = f"### {row['gym_name']}"
                        if is_past: gym_label += " <span class='status-badge'>終了済</span>"
                        st.markdown(gym_label, unsafe_allow_html=True)
                    with col_link:
                        st.link_button("詳細確認", row['post_url'], use_container_width=True)
                
                st.markdown("</div>", unsafe_allow_html=True)
        else:
            st.info(f"{selected_month} の予定はありません。")

# ==========================================
# Tab 2: よく行くジム
# ==========================================
with tab2:
    st.title("🔍 よく行くジム")
    with st.expander("＋ 新規ジム登録", expanded=False):
        with st.form("master_form", clear_on_submit=True):
            name = st.text_input("ジム名")
            url = st.text_input("Instagram プロフィールURL")
            if st.form_submit_button("ジムを登録"):
                if name and url:
                    new_m = pd.concat([master_df, pd.DataFrame([{"gym_name": name, "profile_url": url}])], ignore_index=True)
                    conn.update(worksheet="gym_master", data=new_m)
                    st.success("登録しました")
                    st.rerun()
    
    if not master_df.empty:
        for gym in sorted_gyms:
            row = master_df[master_df['gym_name'] == gym].iloc[0]
            with st.container(border=True):
                c1, c2 = st.columns([2, 1])
                with c1: st.markdown(f"### {row['gym_name']}")
                with c2: st.link_button("Instagram", row['profile_url'], use_container_width=True)
