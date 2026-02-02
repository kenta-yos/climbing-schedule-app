import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif; background-color: #F8F9FA; }
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important; border-radius: 8px !important; padding: 0.6rem 0.8rem !important;
        background-color: white !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
        margin-bottom: 0.5rem !important;
    }
    .past-event { opacity: 0.35; filter: grayscale(1); }
    .gym-name { font-size: 1.0rem; font-weight: 600; margin: 0; color: #333; display: inline-block; }
    .date-text { font-size: 0.75rem; font-weight: 500; color: #888; margin-bottom: 2px; }
    .status-badge { font-size: 0.65rem; padding: 1px 6px; border-radius: 8px; background: #f0f0f0; color: #999; margin-left: 5px; vertical-align: middle; }
    div[data-testid="stLinkButton"] a { padding: 4px 10px !important; font-size: 0.8rem !important; }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_data():
    return conn.read(worksheet="gym_master", ttl=0), conn.read(worksheet="schedules", ttl=0)
master_df, schedule_df = load_data()

# --- 状態管理の初期化 ---
if 'date_count' not in st.session_state: st.session_state.date_count = 1
# 各日程の入力値を保持する辞書
for i in range(5):
    if f's_date_{i}' not in st.session_state: st.session_state[f's_date_{i}'] = datetime.now().date()
    if f'e_date_{i}' not in st.session_state: st.session_state[f'e_date_{i}'] = datetime.now().date()

sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

# タブの選択状態を保持（リロード対策）
tab_index = 0
tab1, tab2 = st.tabs(["🗓 セットスケジュール", "🔍 よく行くジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    with st.expander("＋ 新規予定を追加", expanded=(st.session_state.date_count > 1)):
        if not sorted_gyms: st.warning("先にジムを登録してください")
        else:
            with st.form("add_form", clear_on_submit=True):
                sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
                p_url = st.text_input("Instagram URL")
                
                for i in range(st.session_state.date_count):
                    st.write(f"日程 {i+1}")
                    c1, c2 = st.columns(2)
                    
                    # 開始日が変更されたら終了日を書き換えるコールバック用ロジック（Form内なのでSubmit時に判定も可だが、今回は利便性優先）
                    with c1:
                        # keyを指定してsession_stateで管理
                        s_val = st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                    with c2:
                        # 開始日が更新されていたら終了日のデフォルトを開始日に合わせる
                        e_val = st.date_input(f"終了 {i+1}", value=st.session_state[f"s_date_{i}"], key=f"e_date_input_{i}")
                
                if st.form_submit_button("この内容で保存"):
                    if sel_gym != "(選択)" and p_url:
                        new_data = []
                        for i in range(st.session_state.date_count):
                            new_data.append({
                                "gym_name": sel_gym, 
                                "start_date": st.session_state[f"s_date_{i}"].isoformat(), 
                                "end_date": st.session_state[f"e_date_input_{i}"].isoformat(), 
                                "post_url": p_url
                            })
                        conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_data)], ignore_index=True))
                        # 保存後はリセット
                        st.session_state.date_count = 1
                        st.rerun()

            # 枠追加ボタンをFormの外に配置（ここが押されても全体の再読込を抑える）
            if st.session_state.date_count < 5:
                if st.button("＋ 日程枠を増やす"):
                    st.session_state.date_count += 1
                    st.rerun()

    # --- リスト表示部分は変更なし ---
    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        today = pd.to_datetime(datetime.now().date())
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        all_m = sorted(s_df['month_year'].unique().tolist())
        cur_m = datetime.now().strftime('%Y年%m月')
        if cur_m not in all_m: all_m.append(cur_m); all_m.sort()
        sel_m = st.selectbox("月", options=all_m, index=all_m.index(cur_m), label_visibility="collapsed")
        month_df = s_df[s_df['month_year'] == sel_m].copy()
        if not month_df.empty:
            month_df['is_past'] = month_df['end_date'] < today
            month_df = month_df.sort_values(by=['is_past', 'start_date'], ascending=[True, True])
            for _, row in month_df.iterrows():
                past_tag = "past-event" if row['is_past'] else ""
                with st.container(border=True):
                    st.markdown(f"<div class='{past_tag}'><div class='date-text'>{row['start_date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}</div></div>", unsafe_allow_html=True)
                    c_info, c_link = st.columns([1.8, 1])
                    with c_info:
                        badge = "<span class='status-badge'>終了</span>" if row['is_past'] else ""
                        st.markdown(f"<div class='{past_tag}'><span class='gym-name'>{row['gym_name']}</span>{badge}</div>", unsafe_allow_html=True)
                    with c_link:
                        st.link_button("Instagram", row['post_url'], use_container_width=True)

# ==========================================
# Tab 2: よく行くジム
# ==========================================
with tab2:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("m_form", clear_on_submit=True):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True)); st.rerun()

    if not master_df.empty:
        for gym_name in sorted_gyms:
            row = master_df[master_df['gym_name'] == gym_name].iloc[0]
            with st.container(border=True):
                c_txt, c_btn = st.columns([1.8, 1])
                with c_txt: st.markdown(f"<span class='gym-name'>{row['gym_name']}</span>", unsafe_allow_html=True)
                with c_btn: st.link_button("Instagram", row['profile_url'], use_container_width=True)
