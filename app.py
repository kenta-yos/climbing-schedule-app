import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date
import calendar
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極の崩れ防止CSS（最終訪問日・強調版） ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; max-width: 500px; }

    /* サマリーカード */
    .insta-card {
        background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%);
        color: white; padding: 20px; border-radius: 15px; text-align: center;
        margin-bottom: 15px; box-shadow: 0 8px 16px rgba(221, 36, 118, 0.15);
    }
    .insta-val { font-size: 2.2rem; font-weight: 800; line-height: 1.1; }
    .insta-label { font-size: 0.8rem; opacity: 0.9; }

    /* リスト構造 */
    .item-box {
        display: table !important;
        width: 100% !important;
        padding: 10px 0 !important;
        border-bottom: 1px solid #F5F5F5 !important;
        text-decoration: none !important;
        table-layout: fixed !important;
    }
    .item-accent {
        display: table-cell !important;
        width: 4px !important;
        background-color: #DD2476 !important;
        border-radius: 2px !important;
    }
    .item-date {
        display: table-cell !important;
        width: 85px !important;
        color: #DD2476 !important;
        font-weight: 700 !important;
        font-size: 0.8rem !important;
        padding-left: 8px !important;
        vertical-align: middle !important;
    }
    .item-gym {
        display: table-cell !important;
        color: #1A1A1A !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        padding-left: 5px !important;
        vertical-align: middle !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }
    .past-opacity { opacity: 0.3 !important; }

    /* ジム一覧カード（強化版） */
    .gym-row {
        background-color: #F8F9FA !important;
        border-radius: 12px !important;
        border: 1px solid #EEE !important;
        padding: 15px !important;
        margin-bottom: 10px !important;
        display: block !important;
        text-decoration: none !important;
    }
    .gym-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 5px !important;
    }
    .gym-name { color: #1A1A1A !important; font-weight: 700; font-size: 1rem; }
    .gym-meta-box {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        border-top: 1px solid #EAEAEA !important;
        padding-top: 8px !important;
        margin-top: 5px !important;
    }
    .gym-last-date { color: #666 !important; font-size: 0.8rem; font-weight: 500; }
    .gym-link { color: #DD2476 !important; font-size: 0.75rem; font-weight: 700; text-decoration: none; }
    </style>
    """, unsafe_allow_html=True)

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    return (conn.read(worksheet="gym_master", ttl=10),
            conn.read(worksheet="schedules", ttl=10),
            conn.read(worksheet="climbing_logs", ttl=10))

try:
    master_df, schedule_df, log_df = load_all_data()
except:
    st.error("API制限中です。少し待ってから再読み込みしてください。")
    st.stop()

sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []
if 'date_count' not in st.session_state: st.session_state.date_count = 1

tab1, tab2, tab3 = st.tabs(["セットスケジュール", "ログ", "ジム"])

# --- Tab 1 & Tab 2 は前回の「機能維持版」と同じ内容 ---
# (中略：これまでの全ての登録・表示機能を保持)

# ※ Tab 1 & 2 のコードをここに含めています
with tab1:
    with st.expander("＋ スケジュールを登録"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            for i in range(st.session_state.date_count):
                c1, c2 = st.columns(2)
                with c1: s_d = st.date_input(f"開始日 {i+1}", key=f"s_date_{i}")
                with c2: e_d = st.date_input(f"終了日 {i+1}", value=s_d, key=f"e_date_{i}")
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)":
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{j}"].isoformat(), "end_date": st.session_state[f"e_date_{j}"].isoformat(), "post_url": p_url} for j in range(st.session_state.date_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.session_state.date_count = 1; st.rerun()
        if st.button("＋ 日程を追加"):
            st.session_state.date_count += 1; st.rerun()
    if not schedule_df.empty:
        s_df = schedule_df.copy(); s_df['start_date'] = pd.to_datetime(s_df['start_date']); s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=months, index=months.index(cur_m) if cur_m in months else 0)
        for _, row in s_df[s_df['month_year'] == sel_m].sort_values('start_date').iterrows():
            is_past = row['end_date'].date() < date.today()
            d_s, d_e = row['start_date'].strftime('%m/%d'), row['end_date'].strftime('%m/%d')
            st.markdown(f'<a href="{row["post_url"]}" target="_blank" class="item-box {"past-opacity" if is_past else ""}"><div class="item-accent"></div><div class="item-date">{d_s if d_s==d_e else f"{d_s}-{d_e}"}</div><div class="item-gym">{row["gym_name"]}</div></a>', unsafe_allow_html=True)

with tab2:
    with st.expander("＋ 登攀を記録"):
        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=date.today())
            l_gym = st.selectbox("ジムを選択", options=["(選択)"] + sorted_gyms)
            if st.form_submit_button("保存"):
                if l_gym != "(選択)":
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])], ignore_index=True))
                    st.rerun()
    if not log_df.empty:
        today = date.today()
        first_day, last_day = today.replace(day=1), today.replace(day=calendar.monthrange(today.year, today.month)[1])
        c1, c2 = st.columns(2)
        with c1: start_q = st.date_input("自", value=first_day)
        with c2: end_q = st.date_input("至", value=last_day)
        df_l = log_df.copy(); df_l['date'] = pd.to_datetime(df_l['date'])
        disp_df = df_l[(df_l['date'].dt.date >= start_q) & (df_l['date'].dt.date <= end_q)]
        if not disp_df.empty:
            st.markdown(f'<div class="insta-card"><div class="insta-label">{start_q.strftime("%m/%d")} 〜 {end_q.strftime("%m/%d")}</div><div style="display: flex; justify-content: space-around; margin-top: 10px;"><div><div class="insta-val">{len(disp_df)}</div><div class="insta-label">Sessions</div></div><div><div class="insta-val">{disp_df["gym_name"].nunique()}</div><div class="insta-label">Gyms</div></div></div></div>', unsafe_allow_html=True)
            counts = disp_df['gym_name'].value_counts().reset_index(); counts.columns = ['gym_name', 'count']
            counts = counts.sort_values('count', ascending=True)
            fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', color='count', color_continuous_scale='Sunsetdark')
            fig.update_traces(texttemplate='  <b>%{text}回</b>', textposition='outside', marker_line_width=0, width=0.6)
            fig.update_layout(showlegend=False, coloraxis_showscale=False, xaxis_visible=False, yaxis_title=None, margin=dict(t=10, b=10, l=10, r=80), height=max(150, 150 + (len(counts) * 35)), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', bargap=0.4, font=dict(size=13))
            st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f'<div class="item-box"><div class="item-accent"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-gym">{row["gym_name"]}</div></div>', unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム（最終訪問日を強調！）
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("保存"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.rerun()

    # 最終訪問日のデータを整理
    last_v = {}
    if not log_df.empty:
        df_v = log_df.copy(); df_v['date'] = pd.to_datetime(df_v['date'])
        last_v = df_v.groupby('gym_name')['date'].max().dt.strftime('%Y/%m/%d').to_dict()

    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        last_date = last_v.get(gym, "なし")
        
        st.markdown(f"""
            <div class="gym-row">
                <div class="gym-header">
                    <span class="gym-name">{gym}</span>
                </div>
                <div class="gym-meta-box">
                    <span class="gym-last-date">📅 Last: {last_date}</span>
                    <a href="{url}" target="_blank" class="gym-link">Instagram ↗</a>
                </div>
            </div>
        """, unsafe_allow_html=True)
