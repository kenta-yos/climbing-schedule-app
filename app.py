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
    .past-event { opacity: 0.4; filter: grayscale(1); }
    h1 { font-size: 1.6rem !important; font-weight: 700 !important; margin-bottom: 1.5rem !important; }
    h3 { font-size: 1.1rem !important; font-weight: 600 !important; margin: 0 !important; }
    .delete-confirm { color: #d32f2f; font-weight: bold; font-size: 0.85rem; margin-bottom: 10px; }
    </style>
    """, unsafe_allow_html=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    m = conn.read(worksheet="gym_master", ttl=0)
    s = conn.read(worksheet="schedules", ttl=0)
    return m, s

master_df, schedule_df = load_data()

# 状態管理の初期化
if 'expanded_gym' not in st.session_state:
    st.session_state.expanded_gym = None

gym_usage = schedule_df['gym_name'].value_counts() if not schedule_df.empty else pd.Series()
sorted_gyms = sorted(master_df['gym_name'].tolist(), key=lambda x: gym_usage.get(x, 0), reverse=True) if not master_df.empty else []

tab1, tab2 = st.tabs(["🗓 スケジュール", "🔍 よく行くジム"])

# ==========================================
# Tab 1: スケジュール（省略なしの統合版）
# ==========================================
with tab1:
    st.title("🧗‍♂️ セットスケジュール")
    with st.expander("＋ 新規登録"):
        if not sorted_gyms:
            st.warning("先に「よく行くジム」を登録してください")
        else:
            if 'date_count' not in st.session_state: st.session_state.date_count = 1
            with st.form("add_form", clear_on_submit=True):
                selected_gym = st.selectbox("ジムを選択", options=["(選択してください)"] + sorted_gyms)
                post_url = st.text_input("投稿URL (Instagram)")
                date_inputs = []
                for i in range(st.session_state.date_count):
                    st.write(f"日程 {i+1}")
                    c1, c2 = st.columns(2)
                    with c1: s_val = st.date_input(f"開始 {i+1}", key=f"s_in_{i}")
                    with c2: e_val = st.date_input(f"終了 {i+1}", key=f"e_in_{i}")
                    date_inputs.append((s_val, e_val))
                if st.form_submit_button("保存"):
                    if selected_gym != "(選択してください)" and post_url:
                        new_entries = [{"gym_name": selected_gym, "start_date": s.isoformat(), "end_date": e.isoformat(), "post_url": post_url} for s, e in date_inputs]
                        conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_entries)], ignore_index=True))
                        st.session_state.date_count = 1
                        st.rerun()
            if st.session_state.date_count < 5:
                if st.button("＋ 日程を追加"):
                    st.session_state.date_count += 1
                    st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        today = pd.to_datetime(datetime.now().date())
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        all_months = sorted(s_df['month_year'].unique().tolist())
        cur_month = datetime.now().strftime('%Y年%m月')
        if cur_month not in all_months: all_months.append(cur_month); all_months.sort()
        selected_month = st.selectbox("表示月", options=all_months, index=all_months.index(cur_month))
        month_df = s_df[s_df['month_year'] == selected_month].copy()
        
        if not month_df.empty:
            month_df['is_past'] = month_df['end_date'] < today
            month_df = month_df.sort_values(by=['is_past', 'start_date'], ascending=[True, True])
            for idx, row in month_df.iterrows():
                past_class = "past-event" if row['is_past'] else ""
                with st.container(border=True):
                    st.markdown(f"<div class='{past_class}'>🗓 {row['start_date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}</div>", unsafe_allow_html=True)
                    c_info, c_btn = st.columns([3, 1])
                    with c_info: st.markdown(f"### {row['gym_name']}" + (" <span class='status-badge'>終了済</span>" if row['is_past'] else ""), unsafe_allow_html=True)
                    with c_btn: st.link_button("Instagram", row['post_url'], use_container_width=True)
                    with st.expander("✎ 編集・削除"):
                        ns = st.date_input("開始日", value=row['start_date'], key=f"es_{idx}")
                        ne = st.date_input("終了日", value=row['end_date'], key=f"ee_{idx}")
                        nu = st.text_input("URL", value=row['post_url'], key=f"eu_{idx}")
                        ce1, ce2 = st.columns(2)
                        if ce1.button("更新", key=f"up_s_{idx}"):
                            schedule_df.loc[idx, ['start_date', 'end_date', 'post_url']] = [ns.isoformat(), ne.isoformat(), nu]
                            conn.update(worksheet="schedules", data=schedule_df); st.rerun()
                        if ce2.button("🗑 削除", key=f"dl_s_{idx}"):
                            conn.update(worksheet="schedules", data=schedule_df.drop(idx)); st.rerun()

# ==========================================
# Tab 2: よく行くジム（ここを劇的改善）
# ==========================================
with tab2:
    st.title("🔍 よく行くジム")
    with st.expander("＋ 新規ジム登録"):
        with st.form("m_form", clear_on_submit=True):
            n = st.text_input("ジム名"); u = st.text_input("プロフィールURL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.rerun()

    if not master_df.empty:
        for idx, gym_name in enumerate(sorted_gyms):
            row_idx = master_df[master_df['gym_name'] == gym_name].index[0]
            row = master_df.loc[row_idx]
            
            # このジムの編集画面が開かれているかどうかを判定
            is_expanded = (st.session_state.expanded_gym == gym_name)
            
            with st.container(border=True):
                c1, c2 = st.columns([3, 1])
                with c1: st.markdown(f"### {row['gym_name']}")
                with c2: st.link_button("Instagram", row['profile_url'], use_container_width=True)
                
                # 状態を維持するためのexpander
                with st.expander("✎ ジム情報を編集 / 削除", expanded=is_expanded):
                    # 開いたことを記録する（何か入力やクリックがあった時にここが維持される）
                    if st.button("この画面の編集状態をロック", key=f"lock_{idx}"):
                        st.session_state.expanded_gym = gym_name
                        st.rerun()
                    
                    edit_n = st.text_input("ジム名", value=row['gym_name'], key=f"gn_{idx}")
                    edit_u = st.text_input("プロフURL", value=row['profile_url'], key=f"gu_{idx}")
                    
                    if st.button("更新を保存", key=f"gup_{idx}"):
                        master_df.loc[row_idx, ['gym_name', 'profile_url']] = [edit_n, edit_u]
                        schedule_df.loc[schedule_df['gym_name'] == row['gym_name'], 'gym_name'] = edit_n
                        conn.update(worksheet="gym_master", data=master_df)
                        conn.update(worksheet="schedules", data=schedule_df)
                        st.session_state.expanded_gym = None # 完了したら閉じる
                        st.rerun()

                    st.write("---")
                    rel_count = len(schedule_df[schedule_df['gym_name'] == gym_name])
                    st.markdown(f"<div class='delete-confirm'>⚠️ スケジュール {rel_count} 件も削除されます</div>", unsafe_allow_html=True)
                    
                    # チェックボックス。押すとリロードされるが、expanded=is_expanded により閉じない
                    conf = st.checkbox("削除を承認する", key=f"cdel_{idx}", value=False)
                    if conf:
                        st.session_state.expanded_gym = gym_name # チェック時も状態維持
                        if st.button(f"🗑 {row['gym_name']} を完全に削除", key=f"greal_{idx}"):
                            new_m = master_df.drop(row_idx)
                            new_s = schedule_df[schedule_df['gym_name'] != gym_name]
                            conn.update(worksheet="gym_master", data=new_m)
                            conn.update(worksheet="schedules", data=new_s)
                            st.session_state.expanded_gym = None
                            st.rerun()
