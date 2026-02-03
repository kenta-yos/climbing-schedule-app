import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date

st.set_page_config(page_title="ボルダリングジム管理", layout="centered")

# --- スコア設定 ---
SCORE_NEW_SET = 50
SCORE_LONG_ABSENCE = 30
SCORE_FRIENDS = 10

# --- Google Sheets 接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)

@st.cache_data(ttl=30)
def load_data():
    gyms = conn.read(worksheet="gym_master")
    schedules = conn.read(worksheet="schedules")
    logs = conn.read(worksheet="climbing_logs")
    return gyms, schedules, logs

gym_df, schedule_df, log_df = load_data()

# 型変換
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
schedule_df['end_date'] = pd.to_datetime(schedule_df['end_date'])
log_df['date'] = pd.to_datetime(log_df['date'])

# --- ユーザー管理 ---
if 'user_name' not in st.session_state:
    st.session_state.user_name = ""
if not st.session_state.user_name:
    st.session_state.user_name = st.text_input("あなたの名前を入力してください（必須）")
    if not st.session_state.user_name:
        st.stop()
USER = st.session_state.user_name

# --- スコア計算 ---
def calculate_gym_scores(gym_df, schedule_df, log_df, user):
    today = datetime.now().date()
    scores = []
    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score = 0
        reasons = []

        # セット情報
        gym_sched = schedule_df[schedule_df['gym_name'] == name]
        if not gym_sched.empty:
            latest_set = gym_sched['start_date'].max().date()
            days_since = (today - latest_set).days
            if days_since <= 7:
                score += SCORE_NEW_SET
                reasons.append(f"🔥 新セット({days_since}日前)")
            elif days_since <= 14:
                score += SCORE_NEW_SET // 2
                reasons.append("✨ 準新セット")

        # 履歴
        my_logs = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '実績') & (log_df['user']==user)]
        if not my_logs.empty:
            last_v = my_logs['date'].max().date()
            days_v = (today - last_v).days
            if days_v >= 30:
                score += SCORE_LONG_ABSENCE
                reasons.append(f"⌛ {days_v}日ぶり")
        else:
            score += SCORE_LONG_ABSENCE
            reasons.append(":new: 初訪問")

        # 仲間
        friends = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '予定') & (log_df['date'].dt.date == today)]
        if not friends.empty:
            score += SCORE_FRIENDS * len(friends)
            reasons.append(f"👥 仲間{len(friends)}人")

        scores.append({
            "gym_name": name,
            "total_score": score,
            "reasons": reasons,
            "area": gym.get('area_tag', ''),
            "url": gym.get('profile_url', '')
        })
    return sorted(scores, key=lambda x: x['total_score'], reverse=True)

# --- タブ ---
tab1, tab2, tab3 = st.tabs([":house: Today", ":memo: ログ/予定", ":gear: 管理"])

# ==========================================
# Tab1: 今日のおすすめ + 登録（カード表示）
# ==========================================
with tab1:
    st.markdown("### :dart: 今日のおすすめジム")
    ranked_gyms = calculate_gym_scores(gym_df, schedule_df, log_df, USER)

    def render_gym_card(gym):
        reasons_html = " ".join([f'<span style="background:#FFF0F0; color:#FF512F; padding:2px 6px; border-radius:8px; font-size:0.8rem; margin:2px; border:1px solid #FFE0E0;">{r}</span>' for r in gym['reasons']])
        st.markdown(f"""
            <div style="border-left:5px solid {'#FF512F' if gym['total_score']>=50 else '#CCC'}; background:#fff; padding:12px; border-radius:10px; margin-bottom:12px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between;">
                    <strong>{gym['gym_name']}</strong>
                    <span style="color:#888;">{gym['area']}</span>
                </div>
                <div style="margin-top:6px;">{reasons_html}</div>
            </div>
        """, unsafe_allow_html=True)
        c1,c2,c3 = st.columns([1,1,1])
        with c1:
            if st.button(f"登るよ ({gym['gym_name']})", key=f"plan_{gym['gym_name']}"):
                new_row = pd.DataFrame([{"date": date.today().isoformat(), "gym_name": gym['gym_name'], "type":"予定", "user":USER}])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df,new_row],ignore_index=True))
                st.experimental_rerun()
        with c2:
            if st.button(f"登った ({gym['gym_name']})", key=f"log_{gym['gym_name']}"):
                new_row = pd.DataFrame([{"date": date.today().isoformat(), "gym_name": gym['gym_name'], "type":"実績", "user":USER}])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df,new_row],ignore_index=True))
                st.experimental_rerun()
        with c3:
            if gym['url']:
                st.markdown(f"[Instagram]({gym['url']})")

    for gym in ranked_gyms[:2]:
        render_gym_card(gym)

    st.markdown("---")
    st.markdown("### ジム一覧")
    for _, gym in gym_df.iterrows():
        render_gym_card({"gym_name":gym['gym_name'], "total_score":0, "reasons":[],"area":gym.get('area_tag',''),"url":gym.get('profile_url','')})

# ==========================================
# Tab2: ログ/予定閲覧（グラフ表示）
# ==========================================
with tab2:
    st.markdown("### :calendar: 過去ログ")
    start_date = st.date_input("開始日", value=date.today().replace(day=1))
    end_date = st.date_input("終了日", value=date.today())
    logs_filtered = log_df[(log_df['date'].dt.date >= start_date) & (log_df['date'].dt.date <= end_date) & (log_df['user']==USER)]
    if not logs_filtered.empty:
        st.bar_chart(logs_filtered.groupby('date').size())
        st.dataframe(logs_filtered.sort_values('date', ascending=False))
    else:
        st.info("ログはまだありません。")

    st.markdown("### :spiral_calendar: 仲間の予定")
    friends_logs = log_df[(log_df['type']=='予定') & (log_df['date'].dt.date >= start_date) & (log_df['date'].dt.date <= end_date)]
    if not friends_logs.empty:
        heatmap = friends_logs.groupby(['date','gym_name']).size().unstack(fill_value=0)
        st.bar_chart(heatmap)
        st.dataframe(friends_logs.sort_values(['date','gym_name']))
    else:
        st.info("仲間の予定はまだありません。")

# ==========================================
# Tab3: 管理（ジム・セット登録）
# ==========================================
with tab3:
    st.markdown("### :gear: ジム登録")
    gym_name = st.text_input("ジム名")
    gym_url = st.text_input("Instagram URL")
    gym_area = st.text_input("エリアタグ")
    if st.button("登録"):
        if gym_name:
            new_gym = pd.DataFrame([{"gym_name":gym_name,"profile_url":gym_url,"area_tag":gym_area}])
            conn.update(worksheet="gym_master", data=pd.concat([gym_df,new_gym],ignore_index=True))
            st.experimental_rerun()

    st.markdown("---")
    st.markdown("### :gear: セットスケジュール登録")
    sel_gym = st.selectbox("ジムを選択", options=gym_df['gym_name'].tolist())
    start_dt = st.date_input("開始日")
    end_dt = st.date_input("終了日", value=start_dt)
    set_url = st.text_input("Instagram URL")
    if st.button("登録セット"):
        if sel_gym:
            new_set = pd.DataFrame([{"gym_name":sel_gym,"start_date":start_dt.isoformat(),"end_date":end_dt.isoformat(),"post_url":set_url}])
            conn.update(worksheet="schedules", data=pd.concat([schedule_df,new_set],ignore_index=True))
            st.experimental_rerun()
