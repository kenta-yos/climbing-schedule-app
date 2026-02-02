import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 徹底レイアウト固定 CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #FFFFFF; }

    /* タイムライン全体のコンテナ（左端に寄せる） */
    .timeline-wrapper {
        position: relative !important;
        margin-top: 20px !important;
        padding-left: 0px !important;
    }

    /* 赤い垂直線：位置を5pxで完全固定 */
    .timeline-line {
        position: absolute !important;
        left: 5px !important;
        top: 0 !important;
        bottom: 0 !important;
        width: 2px !important;
        background-color: #B22222 !important;
        z-index: 1 !important;
    }

    /* 各アイテム：高さを一定にしてズレを防ぐ */
    .timeline-item {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        padding: 10px 0 10px 25px !important; /* 線を避ける */
        text-decoration: none !important;
        z-index: 2 !important;
        min-height: 45px !important;
    }

    /* 赤いドット：線の中心（5px）に合わせる */
    .timeline-dot {
        position: absolute !important;
        left: 5px !important;
        top: 50% !important;
        width: 12px !important;
        height: 12px !important;
        background-color: #B22222 !important;
        border-radius: 50% !important;
        border: 2px solid #FFFFFF !important;
        transform: translate(-50%, -50%) !important; /* 完全に中心へ */
        box-shadow: 0 0 0 1px #B22222 !important;
    }

    /* 日付テキスト：幅を固定 */
    .time-date {
        color: #B22222 !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        width: 90px !important;
        flex-shrink: 0 !important;
    }

    /* ジム名 */
    .time-gym {
        color: #1A1A1A !important;
        font-weight: 500 !important;
        font-size: 1rem !important;
    }

    /* ジムカード（タブ3用） */
    .gym-card {
        display: block !important;
        padding: 14px 18px !important;
        margin-bottom: 8px !important;
        background-color: #F8F9FA !important;
        border-radius: 8px !important;
        text-decoration: none !important;
        color: #1A1A1A !important;
        font-weight: 500 !important;
        border: 1px solid #F1F3F5 !important;
    }

    .past-item { opacity: 0.4 !important; filter: grayscale(1) !important; }
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

tab1, tab2, tab3 = st.tabs(["セットスケジュール", "ログ", "ジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    with st.expander("＋ スケジュールを登録"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            # セッション状態から日程数を取得（デフォルト1）
            d_count = st.session_state.get('date_count', 1)
            for i in range(d_count):
                st.write(f"日程 {i+1}")
                c1, c2 = st.columns(2)
                with c1: st.date_input(f"開始 {i+1}", key=f"s_date_{i}")
                with c2: st.date_input(f"終了 {i+1}", key=f"e_date_{i}")
            
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)" and p_url:
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{i}"].isoformat(), "end_date": st.session_state[f"e_date_{i}"].isoformat(), "post_url": p_url} for i in range(d_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.session_state.date_count = 1; st.rerun()

        if st.button("＋ 日程枠を追加"):
            st.session_state.date_count = st.session_state.get('date_count', 1) + 1
            st.rerun()

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
        
        # タイムライン描画
        st.markdown('<div class="timeline-wrapper"><div class="timeline-line"></div>', unsafe_allow_html=True)
        for _, row in m_df.sort_values(['is_past', 'start_date']).iterrows():
            d_display = row['start_date'].strftime('%m/%d') if row['start_date'] == row['end_date'] else f"{row['start_date'].strftime('%m/%d')}-{row['end_date'].strftime('%m/%d')}"
            st.markdown(f'<a href="{row["post_url"]}" target="_blank" class="timeline-item {"past-item" if row["is_past"] else ""}"><div class="timeline-dot"></div><span class="time-date">{d_display}</span><span class="time-gym">{row["gym_name"]}</span></a>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

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
                st.rerun()

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

            # ログも同じタイムラインUI
            st.markdown('<div class="timeline-wrapper"><div class="timeline-line"></div>', unsafe_allow_html=True)
            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f'<div class="timeline-item" style="pointer-events:none;"><div class="timeline-dot"></div><span class="time-date">{row["date"].strftime("%m/%d")}</span><span class="time-gym">{row["gym_name"]}</span></div>', unsafe_allow_html=True)
            st.markdown('</div>', unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True)); st.rerun()
    st.write("")
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f'<a href="{url}" target="_blank" class="gym-card">{gym}</a>', unsafe_allow_html=True)
