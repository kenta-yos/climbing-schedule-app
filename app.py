import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 堅牢なCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; }
    .custom-list-item { display: flex !important; align-items: center !important; width: 100% !important; padding: 12px 0 !important; border-bottom: 1px solid #F0F0F0 !important; text-decoration: none !important; }
    .custom-accent { width: 4px !important; height: 1.2rem !important; background-color: #B22222 !important; margin-right: 12px !important; flex-shrink: 0 !important; border-radius: 2px !important; }
    .custom-date { color: #B22222 !important; font-weight: 700 !important; font-size: 0.95rem !important; width: 100px !important; flex-shrink: 0 !important; }
    .custom-gym { color: #1A1A1A !important; font-weight: 700 !important; font-size: 1.05rem !important; flex-grow: 1 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
    .past-item { opacity: 0.4 !important; }
    .gym-card { display: block !important; padding: 16px !important; margin-bottom: 8px !important; background-color: #F8F9FA !important; border-radius: 8px !important; color: #1A1A1A !important; text-decoration: none !important; font-weight: 500 !important; border: 1px solid #E9ECEF !important; }
    .info-box { background-color: #F0F2F6; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; }
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
                    new_entries = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{j}"].isoformat(), "end_date": st.session_state[f"e_date_{j}"].isoformat(), "post_url": p_url} for j in range(st.session_state.date_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_entries)], ignore_index=True))
                    st.toast("できたよ！🎉 登録完了"); st.session_state.date_count = 1; st.rerun()
        if st.button("＋ 日程を増やす"):
            st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date']); s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        all_m = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月 (スケジュール)", options=all_m, index=all_m.index(cur_m) if cur_m in all_m else 0)
        m_df = s_df[s_df['month_year'] == sel_m].copy()
        m_df['is_past'] = m_df['end_date'].dt.date < datetime.now().date()
        for _, row in m_df.sort_values(['is_past', 'start_date']).iterrows():
            d_s, d_e = row['start_date'].strftime('%m/%d'), row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            st.markdown(f'<a href="{row["post_url"]}" target="_blank" class="custom-list-item {"past-item" if row["is_past"] else ""}"><div class="custom-accent"></div><span class="custom-date">{d_disp}</span><span class="custom-gym">{row["gym_name"]}</span></a>', unsafe_allow_html=True)

# ==========================================
# Tab 2: ログ
# ==========================================
with tab2:
    with st.expander("＋ 登攀を記録", expanded=True):
        if st.session_state.last_log: st.success(f"前回保存：{st.session_state.last_log}")
        
        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=datetime.now().date())
            l_gym = st.selectbox("ジムを選択", options=["(選択)"] + sorted_gyms)
            
            # --- ここに「前いつ来た？」「今月何回目？」のプレビューを表示 ---
            if l_gym != "(選択)" and not log_df.empty:
                df_temp = log_df.copy()
                df_temp['date'] = pd.to_datetime(df_temp['date'])
                
                # 前回訪問日の計算
                gym_logs = df_temp[df_temp['gym_name'] == l_gym].sort_values('date', ascending=False)
                if not gym_logs.empty:
                    last_visit = gym_logs.iloc[0]['date']
                    days_ago = (datetime.now().date() - last_visit.date()).days
                    st.info(f"💡 前回訪問: {last_visit.strftime('%m/%d')} ({days_ago}日前)")
                else:
                    st.info("💡 このジムの記録は初めてです！")
                
                # 今月の訪問回数
                this_month = datetime.now().strftime('%Y-%m')
                count_this_month = len(gym_logs[gym_logs['date'].dt.strftime('%Y-%m') == this_month])
                st.markdown(f"🏆 今月このジムに来た回数: **{count_this_month}回目** (今回を含む)")

            if st.form_submit_button("記録を保存"):
                if l_gym != "(選択)":
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])], ignore_index=True))
                    st.toast("おつかれさま！💪 ナイス登攀！")
                    st.session_state.last_log = f"{l_date.strftime('%m/%d')} @ {l_gym}"; st.rerun()

    if not log_df.empty:
        df_l = log_df.copy(); df_l['date'] = pd.to_datetime(df_l['date']); df_l['month_year'] = df_l['date'].dt.strftime('%Y年%m月')
        log_m = sorted(df_l['month_year'].unique().tolist(), reverse=True)
        opts = ["全期間"] + log_m
        cur_m_l = datetime.now().strftime('%Y年%m月')
        sel_p = st.selectbox("表示期間 (ログ)", options=opts, index=opts.index(cur_m_l) if cur_m_l in opts else 0)
        disp_df = df_l if sel_p == "全期間" else df_l[df_l['month_year'] == sel_p]
        
        if not disp_df.empty:
            c1, c2 = st.columns(2)
            c1.metric("登攀回数", f"{len(disp_df)}回"); c2.metric("ジム数", f"{disp_df['gym_name'].nunique()}")
            fig = px.pie(disp_df['gym_name'].value_counts().reset_index(), values='count', names='gym_name', hole=0.6, color_discrete_sequence=px.colors.qualitative.Pastel)
            fig.update_layout(margin=dict(t=10, b=10, l=10, r=10), height=250); st.plotly_chart(fig, use_container_width=True)
            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f'<div class="custom-list-item"><div class="custom-accent"></div><span class="custom-date">{row["date"].strftime("%m/%d")}</span><span class="custom-gym">{row["gym_name"]}</span></div>', unsafe_allow_html=True)

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
                    st.toast(f"✅ {n} を登録！"); st.rerun()
    st.write("")
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f'<a href="{url}" target="_blank" class="gym-card">{gym}</a>', unsafe_allow_html=True)
