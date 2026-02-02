import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date
import calendar
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極の崩れ防止CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; }

    /* リストアイテムの完全固定構造 */
    .item-box {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        padding: 12px 0 !important;
        border-bottom: 1px solid #F0F0F0 !important;
        width: 100% !important;
        text-decoration: none !important;
    }
    .item-accent {
        width: 4px !important;
        height: 1.2rem !important;
        background-color: #B22222 !important;
        margin-right: 12px !important;
        flex-shrink: 0 !important;
        border-radius: 2px !important;
    }
    .item-date {
        color: #B22222 !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        width: 90px !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
    }
    .item-gym {
        color: #1A1A1A !important;
        font-weight: 700 !important;
        font-size: 1rem !important;
        flex-grow: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }
    .past-opacity { opacity: 0.4 !important; }

    /* ジムカードのレイアウト */
    .gym-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 15px !important;
        margin-bottom: 8px !important;
        background-color: #F8F9FA !important;
        border-radius: 8px !important;
        border: 1px solid #E9ECEF !important;
        text-decoration: none !important;
    }
    .gym-name { color: #1A1A1A !important; font-weight: 700 !important; }
    .gym-meta { color: #666 !important; font-size: 0.8rem !important; }
    </style>
    """, unsafe_allow_html=True)

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    return (conn.read(worksheet="gym_master", ttl=0), 
            conn.read(worksheet="schedules", ttl=0), 
            conn.read(worksheet="climbing_logs", ttl=0))

master_df, schedule_df, log_df = load_all_data()
sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

# セッション状態
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
                st.write(f"日程 {i+1}")
                c1, c2 = st.columns(2)
                with c1: s_d = st.date_input(f"開始日", key=f"s_date_{i}")
                with c2: e_d = st.date_input(f"終了日", value=s_d, key=f"e_date_{i}")
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)" and p_url:
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{j}"].isoformat(), "end_date": st.session_state[f"e_date_{j}"].isoformat(), "post_url": p_url} for j in range(st.session_state.date_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.toast("登録完了！🎉"); st.session_state.date_count = 1; st.rerun()
        if st.button("＋ 日程を増やす"):
            st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date']); s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        
        # 表示月のリスト作成とデフォルト設定（当月を優先）
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        this_month_str = datetime.now().strftime('%Y年%m月')
        default_month_idx = months.index(this_month_str) if this_month_str in months else 0
        
        sel_m = st.selectbox("表示月", options=months, index=default_month_idx)
        
        m_df = s_df[s_df['month_year'] == sel_m].sort_values('start_date')
        for _, row in m_df.iterrows():
            is_past = row['end_date'].date() < date.today()
            d_s, d_e = row['start_date'].strftime('%m/%d'), row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            st.markdown(f"""
                <a href="{row['post_url']}" target="_blank" class="item-box {'past-opacity' if is_past else ''}">
                    <div class="item-accent"></div>
                    <span class="item-date">{d_disp}</span>
                    <span class="item-gym">{row['gym_name']}</span>
                </a>
            """, unsafe_allow_html=True)

# ==========================================
# Tab 2: ログ
# ==========================================
with tab2:
    with st.expander("＋ 登攀を記録"):
        if st.session_state.last_log: st.success(f"前回保存：{st.session_state.last_log}")
        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=date.today())
            l_gym = st.selectbox("ジムを選択", options=["(選択)"] + sorted_gyms)
            if st.form_submit_button("記録を保存"):
                if l_gym != "(選択)":
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])], ignore_index=True))
                    st.toast("おつかれさま！💪"); st.session_state.last_log = f"{l_date.strftime('%m/%d')} @ {l_gym}"; st.rerun()

    if not log_df.empty:
        # デフォルト期間を当月の1日〜末日に設定
        today = date.today()
        first_day = today.replace(day=1)
        last_day = today.replace(day=calendar.monthrange(today.year, today.month)[1])

        st.write("### 期間集計")
        c1, c2 = st.columns(2)
        with c1: start_q = st.date_input("開始", value=first_day)
        with c2: end_q = st.date_input("終了", value=last_day)
        
        df_l = log_df.copy(); df_l['date'] = pd.to_datetime(df_l['date'])
        disp_df = df_l[(df_l['date'].dt.date >= start_q) & (df_l['date'].dt.date <= end_q)]
        
        if not disp_df.empty:
            m1, m2 = st.columns(2)
            m1.metric("登攀回数", f"{len(disp_df)}回"); m2.metric("ジム数", f"{disp_df['gym_name'].nunique()}")
            
            counts = disp_df['gym_name'].value_counts().reset_index()
            counts.columns = ['gym_name', 'count']
            counts['label'] = counts.apply(lambda x: f"{x['gym_name']} 【{x['count']}】", axis=1)
            
            fig = px.pie(counts, values='count', names='label', hole=0.6, color_discrete_sequence=px.colors.qualitative.Pastel)
            fig.update_layout(margin=dict(t=0, b=0, l=0, r=0), height=300, legend=dict(orientation="h", y=-0.2))
            st.plotly_chart(fig, use_container_width=True)

            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f"""
                    <div class="item-box">
                        <div class="item-accent"></div>
                        <span class="item-date">{row['date'].strftime('%m/%d')}</span>
                        <span class="item-gym">{row['gym_name']}</span>
                    </div>
                """, unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.toast(f"✅ {n} を登録"); st.rerun()
    
    last_visits = {}
    if not log_df.empty:
        df_v = log_df.copy(); df_v['date'] = pd.to_datetime(df_v['date'])
        last_visits = df_v.groupby('gym_name')['date'].max().dt.strftime('%m/%d').to_dict()

    st.write("")
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        v_date = last_visits.get(gym, "-")
        st.markdown(f"""
            <a href="{url}" target="_blank" class="gym-row">
                <span class="gym-name">{gym}</span>
                <span class="gym-meta">Last: {v_date}</span>
            </a>
        """, unsafe_allow_html=True)
