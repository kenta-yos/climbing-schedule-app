import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極の左寄せ＆1行維持CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #F0F2F5; }

    /* link_buttonの枠組みを左寄せに強制 */
    div[data-testid="stLinkButton"] > a {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important; /* 左寄せ */
        width: 100% !important;
        background-color: white !important;
        color: #1C1E21 !important;
        border: none !important;
        border-radius: 10px !important;
        padding: 12px 18px !important;
        margin-bottom: 8px !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;
        border-left: 5px solid #2E7D32 !important;
        text-decoration: none !important;
    }

    /* ボタンの中のテキスト：改行を禁止し、1行で左寄せ */
    div[data-testid="stLinkButton"] p {
        text-align: left !important;
        margin: 0 !important;
        white-space: nowrap !important; /* 改行禁止 */
        overflow: hidden !important;
        text-overflow: ellipsis !important; /* 長すぎる場合は...で省略 */
        font-size: 1rem !important;
        display: block !important;
        width: 100% !important;
    }

    /* 終了済みカードのスタイル */
    .past-btn a { border-left-color: #9E9E9E !important; opacity: 0.6 !important; }

    /* メトリクス（数字）も左寄せ */
    div[data-testid="stMetric"] > div { text-align: left !important; }
    div[data-testid="stMetric"] { background-color: white; padding: 15px; border-radius: 12px; }
    </style>
    """, unsafe_allow_html=True)

# --- データ読み込み ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    return (conn.read(worksheet="gym_master", ttl=0), 
            conn.read(worksheet="schedules", ttl=0), 
            conn.read(worksheet="climbing_logs", ttl=0))

master_df, schedule_df, log_df = load_all_data()
if 'date_count' not in st.session_state: st.session_state.date_count = 1
sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

tab1, tab2, tab3 = st.tabs(["セット予定", "登攀ログ", "ジム名鑑"])

# ==========================================
# Tab 1: セット予定
# ==========================================
with tab1:
    with st.expander("＋ 新規予定を追加"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            for i in range(st.session_state.date_count):
                c1, c2 = st.columns(2)
                with c1: s_val = st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                with c2: e_val = st.date_input(f"終了 {i+1}", value=s_val, key=f"e_date_{i}")
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)" and p_url:
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{i}"].isoformat(), "end_date": st.session_state[f"e_date_{i}"].isoformat(), "post_url": p_url} for i in range(st.session_state.date_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.toast("✅ 保存しました"); st.session_state.date_count = 1; st.rerun()

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
            d = row['start_date'].strftime('%m/%d') if row['start_date'] == row['end_date'] else f"{row['start_date'].strftime('%m/%d')} - {row['end_date'].strftime('%m/%d')}"
            # 1行で表示するためにスペースで繋ぐ
            label = f"{d}  |  {row['gym_name']}" + (" (終了)" if row['is_past'] else "")
            if row['is_past']: st.markdown('<div class="past-btn">', unsafe_allow_html=True)
            st.link_button(label, row['post_url'], use_container_width=True)
            if row['is_past']: st.markdown('</div>', unsafe_allow_html=True)

# ==========================================
# Tab 2: 登攀ログ
# ==========================================
with tab2:
    with st.expander("＋ 今日の登攀を記録"):
        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=datetime.now().date())
            l_gym = st.selectbox("ジム", options=sorted_gyms)
            if st.form_submit_button("記録"):
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])], ignore_index=True))
                st.toast("🎉 記録しました"); st.rerun()

    if not log_df.empty:
        df_l = log_df.copy()
        df_l['date'] = pd.to_datetime(df_l['date'])
        df_l['month_year'] = df_l['date'].dt.strftime('%Y年%m月')
        mode = st.radio("期間", ["今月", "全期間"], horizontal=True)
        disp_df = df_l[df_l['month_year'] == datetime.now().strftime('%Y年%m月')] if mode == "今月" else df_l
        if not disp_df.empty:
            c1, c2 = st.columns(2); c1.metric("回数", f"{len(disp_df)}回"); c2.metric("ジム", f"{disp_df['gym_name'].nunique()}")
            counts = disp_df['gym_name'].value_counts().reset_index(); counts.columns = ['ジム', '回']
            fig = px.pie(counts, values='回', names='ジム', hole=0.5, color_discrete_sequence=px.colors.sequential.Greens_r)
            fig.update_layout(margin=dict(t=20, b=20, l=20, r=20), height=300); st.plotly_chart(fig, use_container_width=True)
            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f'<div style="background:white; padding:12px 16px; border-radius:10px; margin-bottom:8px; border-left:5px solid #4CAF50; text-align: left;"><span style="font-size:0.8rem; color:#888;">{row["date"].strftime("%m/%d")}</span> | <span style="font-weight:700;">{row["gym_name"]}</span></div>', unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム名鑑
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_form"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True)); st.rerun()
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.link_button(gym, url, use_container_width=True)
