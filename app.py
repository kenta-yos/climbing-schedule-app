import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- デザインCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; }

    .list-item {
        display: flex; align-items: center; padding: 12px 0;
        border-bottom: 1px solid #F0F0F0; text-decoration: none !important;
    }
    .list-accent {
        width: 3px; height: 1.2rem; background-color: #B22222;
        margin-right: 15px; border-radius: 2px;
    }
    .list-date { color: #B22222; font-weight: 700; font-size: 0.9rem; width: 95px; flex-shrink: 0; }
    .list-gym { color: #1A1A1A; font-weight: 700; font-size: 1rem; }
    .gym-card {
        display: block; padding: 16px; margin-bottom: 8px; background-color: #F8F9FA;
        border-radius: 8px; color: #1A1A1A !important; text-decoration: none !important;
        font-weight: 500; border: 1px solid #E9ECEF;
    }
    .past-item { opacity: 0.4; }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    return (conn.read(worksheet="gym_master", ttl=0), 
            conn.read(worksheet="schedules", ttl=0), 
            conn.read(worksheet="climbing_logs", ttl=0))

master_df, schedule_df, log_df = load_all_data()
sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

# セッション状態の初期化
if 'date_count' not in st.session_state: st.session_state.date_count = 1
if 'last_log' not in st.session_state: st.session_state.last_log = None

tab1, tab2, tab3 = st.tabs(["セットスケジュール", "ログ", "ジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    with st.expander("＋ スケジュールを登録", expanded=st.session_state.date_count > 1):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            
            for i in range(st.session_state.date_count):
                st.markdown(f"**日程 {i+1}**")
                c1, c2 = st.columns(2)
                with c1: s_d = st.date_input(f"開始日", key=f"s_date_{i}")
                with c2: e_d = st.date_input(f"終了日", value=s_d, key=f"e_date_{i}")
            
            if st.form_submit_button("保存する"):
                if sel_gym != "(選択)" and p_url:
                    new_entries = []
                    for i in range(st.session_state.date_count):
                        new_entries.append({
                            "gym_name": sel_gym,
                            "start_date": st.session_state[f"s_date_{i}"].isoformat(),
                            "end_date": st.session_state[f"e_date_{i}"].isoformat(),
                            "post_url": p_url
                        })
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_entries)], ignore_index=True))
                    st.toast("できたよ！🎉 登録完了しました。")
                    st.session_state.date_count = 1
                    st.rerun()
        
        if st.button("＋ 日程を増やす"):
            st.session_state.date_count += 1
            st.rerun()

    # スケジュール表示（省略なし）
    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        cur_m = datetime.now().strftime('%Y年%m月')
        all_m = sorted(s_df['month_year'].unique().tolist())
        sel_m = st.selectbox("表示月", options=all_m, index=all_m.index(cur_m) if cur_m in all_m else 0)
        
        m_df = s_df[s_df['month_year'] == sel_m].copy()
        m_df['is_past'] = m_df['end_date'].dt.date < datetime.now().date()
        for _, row in m_df.sort_values(['is_past', 'start_date']).iterrows():
            d_disp = row['start_date'].strftime('%m/%d') if row['start_date'] == row['end_date'] else f"{row['start_date'].strftime('%m/%d')}-{row['end_date'].strftime('%m/%d')}"
            st.markdown(f'<a href="{row["post_url"]}" target="_blank" class="list-item {"past-item" if row["is_past"] else ""}"><div class="list-accent"></div><span class="list-date">{d_disp}</span><span class="list-gym">{row["gym_name"]}</span></a>', unsafe_allow_html=True)

# ==========================================
# Tab 2: ログ
# ==========================================
with tab2:
    with st.expander("＋ 登攀を記録"):
        # 直前の登録内容があれば表示する
        if st.session_state.last_log:
            st.success(f"保存完了：{st.session_state.last_log}")

        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=datetime.now().date())
            l_gym = st.selectbox("ジムを選択", options=["(選択)"] + sorted_gyms)
            
            if st.form_submit_button("記録を保存"):
                if l_gym != "(選択)":
                    new_log = pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_log], ignore_index=True))
                    
                    # トースト通知とおつかれさまメッセージ
                    st.toast("おつかれさま！💪 ナイス登攀！")
                    st.session_state.last_log = f"{l_date.strftime('%m/%d')} @ {l_gym}"
                    st.rerun()
                else:
                    st.error("ジムを選択してください")

    # 統計と一覧
    if not log_df.empty:
        df_l = log_df.copy()
        df_l['date'] = pd.to_datetime(df_l['date'])
        df_l['month_year'] = df_l['date'].dt.strftime('%Y年%m月')
        mode = st.radio("表示期間", ["今月", "全期間"], horizontal=True)
        disp_df = df_l[df_l['month_year'] == datetime.now().strftime('%Y年%m月')] if mode == "今月" else df_l
        
        if not disp_df.empty:
            c1, c2 = st.columns(2)
            c1.metric("登攀回数", f"{len(disp_df)}回")
            c2.metric("ジム数", f"{disp_df['gym_name'].nunique()}")
            counts = disp_df['gym_name'].value_counts().reset_index()
            counts.columns = ['ジム', '回']
            fig = px.pie(counts, values='回', names='ジム', hole=0.6, color_discrete_sequence=px.colors.qualitative.Pastel)
            fig.update_layout(margin=dict(t=10, b=10, l=10, r=10), height=250)
            st.plotly_chart(fig, use_container_width=True)

            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f'<div class="list-item"><div class="list-accent"></div><span class="list-date">{row["date"].strftime("%m/%d")}</span><span class="list-gym">{row["gym_name"]}</span></div>', unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add"):
            n = st.text_input("ジム名")
            u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.toast(f"✅ {n} を登録したよ！")
                    st.rerun()
    st.write("")
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f'<a href="{url}" target="_blank" class="gym-card">{gym}</a>', unsafe_allow_html=True)
