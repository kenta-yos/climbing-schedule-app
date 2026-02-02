import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- CSS（左寄せ・ミニマル） ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #F0F2F5; }
    div[data-testid="stLinkButton"] > a {
        display: block !important; width: 100% !important; background-color: white !important;
        color: #1C1E21 !important; border: none !important; border-radius: 10px !important;
        padding: 14px 18px !important; margin-bottom: 10px !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important; border-left: 5px solid #2E7D32 !important;
        text-align: left !important; line-height: 1.5 !important;
    }
    div[data-testid="stLinkButton"] > a:active { transform: scale(0.98) !important; background-color: #F8F9FA !important; }
    .past-btn a { border-left-color: #9E9E9E !important; opacity: 0.6 !important; }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
master_df = conn.read(worksheet="gym_master", ttl=0)
schedule_df = conn.read(worksheet="schedules", ttl=0)

# --- 状態管理 ---
if 'date_count' not in st.session_state: st.session_state.date_count = 1
# 日程枠を増やす時だけExpanderを開いたままにするためのフラグ
if 'expander_open' not in st.session_state: st.session_state.expander_open = False

sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

tab1, tab2 = st.tabs(["セットスケジュール", "よく行くジム"])

# --- タブ1: セットスケジュール ---
with tab1:
    # 保存後は expanded=False になるように制御
    with st.expander("＋ 新規予定を追加", expanded=st.session_state.expander_open):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            
            new_dates = []
            for i in range(st.session_state.date_count):
                st.write(f"日程 {i+1}")
                c1, c2 = st.columns(2)
                with c1: s_val = st.date_input(f"開始 {i+1}", key=f"s_date_{i}", value=datetime.now().date())
                with c2: e_val = st.date_input(f"終了 {i+1}", key=f"e_date_{i}", value=s_val)
                new_dates.append((s_val, e_val))
            
            submit = st.form_submit_button("この内容で保存")
            
            if submit:
                if sel_gym != "(選択)" and p_url:
                    new_rows = [{"gym_name": sel_gym, "start_date": s.isoformat(), 
                                 "end_date": e.isoformat(), "post_url": p_url} for s, e in new_dates]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    
                    # 成功時のフィードバック
                    st.toast(f"✅ {sel_gym} の予定を保存しました！", icon='🎉')
                    st.session_state.date_count = 1
                    st.session_state.expander_open = False # 保存後は閉じる
                    st.rerun()
                else:
                    st.error("ジムとURLを入力してください")

        if st.session_state.date_count < 5:
            if st.button("＋ 日程枠を増やす"):
                st.session_state.date_count += 1
                st.session_state.expander_open = True # 枠追加時は開いたままにする
                st.rerun()

    # --- リスト表示 ---
    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        
        cur_m = datetime.now().strftime('%Y年%m月')
        all_months = sorted(s_df['month_year'].unique().tolist())
        sel_m = st.selectbox("表示月", options=all_months, index=all_months.index(cur_m) if cur_m in all_months else 0, label_visibility="collapsed")

        month_df = s_df[s_df['month_year'] == sel_m].copy()
        month_df['is_past'] = month_df['end_date'].dt.date < datetime.now().date()
        month_df = month_df.sort_values(by=['is_past', 'start_date'])

        for _, row in month_df.iterrows():
            s_str = row['start_date'].strftime('%m/%d')
            e_str = row['end_date'].strftime('%m/%d')
            date_display = s_str if s_str == e_str else f"{s_str} — {e_str}"
            label = f"{date_display}\n{row['gym_name']}"
            
            if row['is_past']:
                label += " (終了済)"
                st.markdown('<div class="past-btn">', unsafe_allow_html=True)
            
            st.link_button(label, row['post_url'], use_container_width=True)
            
            if row['is_past']:
                st.markdown('</div>', unsafe_allow_html=True)

# --- タブ2: よく行くジム ---
with tab2:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_form", clear_on_submit=True):
            n = st.text_input("ジム名")
            u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.toast(f"✅ {n} を登録しました！")
                    st.rerun()

    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.link_button(gym, url, use_container_width=True)
