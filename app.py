import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- CSS：左寄せ・モダンデザイン ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #FFFFFF; }

    /* HTMLカスタムカード（左寄せ・1行） */
    .custom-link-card {
        display: flex; align-items: center; width: 100%; padding: 14px 18px;
        margin-bottom: 8px; background-color: #F8F9FA; border: 1px solid #E9ECEF;
        border-radius: 8px; text-decoration: none !important; color: #212529 !important;
        transition: all 0.2s ease;
    }
    .custom-link-card:hover { background-color: #E9ECEF; transform: translateY(-1px); }
    .card-date { font-weight: 700; font-size: 0.85rem; color: #6C757D; margin-right: 15px; white-space: nowrap; }
    .card-gym { font-weight: 500; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .past-card { opacity: 0.5; background-color: #F1F3F5; }

    /* 入力フォーム内の左寄せ調整 */
    .stSelectbox, .stTextInput, .stDateInput { text-align: left !important; }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    return (conn.read(worksheet="gym_master", ttl=0), 
            conn.read(worksheet="schedules", ttl=0), 
            conn.read(worksheet="climbing_logs", ttl=0))

master_df, schedule_df, log_df = load_all_data()

# セッション状態の管理
if 'date_count' not in st.session_state: st.session_state.date_count = 1
sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

# --- タブ設定（名称変更） ---
tab1, tab2, tab3 = st.tabs(["セットスケジュール", "ログ", "ジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    with st.expander("＋ スケジュールを登録"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            
            # 複数日程の入力枠
            new_dates = []
            for i in range(st.session_state.date_count):
                st.write(f"日程 {i+1}")
                c1, c2 = st.columns(2)
                with c1: s_val = st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                with c2: e_val = st.date_input(f"終了 {i+1}", value=s_val, key=f"e_date_{i}")
            
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)" and p_url:
                    new_rows = []
                    for i in range(st.session_state.date_count):
                        new_rows.append({
                            "gym_name": sel_gym, 
                            "start_date": st.session_state[f"s_date_{i}"].isoformat(), 
                            "end_date": st.session_state[f"e_date_{i}"].isoformat(), 
                            "post_url": p_url
                        })
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.toast("✅ 保存しました"); st.session_state.date_count = 1; st.rerun()
                else:
                    st.error("ジムとURLを入力してください")

        if st.session_state.date_count < 5:
            if st.button("＋ 日程枠を追加"):
                st.session_state.date_count += 1
                st.rerun()

    # スケジュール表示
    if not schedule_df.empty:
        s_df = schedule_df.copy()
        s_df['start_date'] = pd.to_datetime(s_df['start_date'])
        s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        
        all_m = sorted(s_df['month_year'].unique().tolist())
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=all_m, index=all_m.index(cur_m) if cur_m in all_m else 0)
        
        m_df = s_df[s_df['month_year'] == sel_m].copy()
        m_df['is_past'] = m_df['end_date'].dt.date < datetime.now().date()
        
        for _, row in m_df.sort_values(['is_past', 'start_date']).iterrows():
            d_s, d_e = row['start_date'].strftime('%m/%d'), row['end_date'].strftime('%m/%d')
            d_display = d_s if d_s == d_e else f"{d_s}-{d_e}"
            past_class = "past-card" if row['is_past'] else ""
            
            st.markdown(f"""
                <a href="{row['post_url']}" target="_blank" class="custom-link-card {past_class}">
                    <span class="card-date">{d_display}</span>
                    <span class="card-gym">{row['gym_name']}{' (終了)' if row['is_past'] else ''}</span>
                </a>
            """, unsafe_allow_html=True)

# ==========================================
# Tab 2: ログ
# ==========================================
with tab2:
    with st.expander("＋ 登攀を記録"):
        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=datetime.now().date())
            l_gym = st.selectbox("ジムを選択", options=sorted_gyms)
            if st.form_submit_button("記録を保存"):
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])], ignore_index=True))
                st.toast("🎉 記録しました"); st.rerun()

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
                st.markdown(f"""
                    <div class="custom-link-card" style="pointer-events: none;">
                        <span class="card-date">{row['date'].strftime('%m/%d')}</span>
                        <span class="card-gym">{row['gym_name']}</span>
                    </div>
                """, unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add_form", clear_on_submit=True):
            new_gym_name = st.text_input("ジム名")
            new_gym_url = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if new_gym_name and new_gym_url:
                    new_gym_df = pd.DataFrame([{"gym_name": new_gym_name, "profile_url": new_gym_url}])
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, new_gym_df], ignore_index=True))
                    st.toast(f"✅ {new_gym_name} を登録しました"); st.rerun()

    # ジム一覧表示
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f"""
            <a href="{url}" target="_blank" class="custom-link-card">
                <span class="card-gym">{gym}</span>
            </a>
        """, unsafe_allow_html=True)
