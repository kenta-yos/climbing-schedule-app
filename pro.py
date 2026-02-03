import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date

st.set_page_config(page_title="セット管理Pro Next", layout="centered")

# --- スコア設定 ---
SCORE_NEW_SET = 50
SCORE_LONG_ABSENCE = 30
SCORE_FRIENDS = 10

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    gyms = conn.read(worksheet="gym_master")
    schedules = conn.read(worksheet="schedules")
    logs = conn.read(worksheet="climbing_logs")

    # 列名トリム
    gyms.columns = gyms.columns.str.strip()
    schedules.columns = schedules.columns.str.strip()
    logs.columns = logs.columns.str.strip()

    return gyms, schedules, logs

gym_df, schedule_df, log_df = load_data()
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
log_df['date'] = pd.to_datetime(log_df['date'])

# --- ユーザー入力 ---
if 'USER' not in st.session_state:
    st.session_state.USER = st.text_input("あなたの名前を入力してください")
USER = st.session_state.USER

# --- スコア計算 ---
def calculate_gym_scores(gym_df, schedule_df, log_df, user):
    today = datetime.now()
    scores = []
    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score = 0
        reasons = []

        # セット情報
        gym_sched = schedule_df[schedule_df['gym_name'] == name]
        if not gym_sched.empty:
            latest_set = gym_sched['start_date'].max()
            days_since = (today - latest_set).days
            if days_since <= 7:
                score += SCORE_NEW_SET
                reasons.append(f"🔥 新セット({days_since}日前)")
            elif days_since <= 14:
                score += (SCORE_NEW_SET // 2)
                reasons.append("✨ 準新セット")

        # 履歴
        if 'user' in log_df.columns:
            my_logs = log_df[(log_df['gym_name'] == name) & (log_df['type']=='実績') & (log_df['user']==user)]
            if not my_logs.empty:
                last_v = my_logs['date'].max()
                days_v = (today - last_v).days
                if days_v >= 30:
                    score += SCORE_LONG_ABSENCE
                    reasons.append(f":hourglass: {days_v}日ぶり")
            else:
                score += SCORE_LONG_ABSENCE
                reasons.append(":new: 初訪問")
        # 仲間
        if 'user' in log_df.columns:
            friends = log_df[(log_df['gym_name']==name) & (log_df['type']=='予定') & (log_df['date'].dt.date==date.today())]
            if not friends.empty:
                score += (SCORE_FRIENDS * len(friends))
                reasons.append(f":busts_in_silhouette: 仲間{len(friends)}人")

        scores.append({
            "gym_name": name,
            "total_score": score,
            "reasons": reasons,
            "area": gym.get('area_tag',''),
            "url": gym.get('profile_url','')
        })
    return sorted(scores, key=lambda x: x['total_score'], reverse=True)

# --- タブ ---
tab1, tab2, tab3 = st.tabs([":dart: 今日のおすすめ", ":memo: 予定/実績ログ", ":gear: ジム管理"])

# ==========================================
# Tab 1: 今日のおすすめ + 登る/登った
# ==========================================
with tab1:
    if USER:
        st.markdown("### 今日のおすすめジム")
        ranked_gyms = calculate_gym_scores(gym_df, schedule_df, log_df, USER)
        for gym in ranked_gyms[:2]:
            with st.container():
                st.markdown(f"**{gym['gym_name']}** ({gym['area']})")
                st.markdown(' '.join(gym['reasons']))
                # ボタン
                c1, c2, c3 = st.columns([1,1,2])
                with c1:
                    if st.button(f"登るよ！_{gym['gym_name']}", key=f"plan_{gym['gym_name']}"):
                        log_df.loc[len(log_df)] = [USER, gym['gym_name'], datetime.now(), '予定']
                        st.success(f"{gym['gym_name']} に行く予定を登録しました")
                with c2:
                    if st.button(f"登った！_{gym['gym_name']}", key=f"log_{gym['gym_name']}"):
                        log_df.loc[len(log_df)] = [USER, gym['gym_name'], datetime.now(), '実績']
                        st.success(f"{gym['gym_name']} の実績を登録しました")
                with c3:
                    st.markdown(f"[Instagram]({gym['url'] if gym['url'] else 'https://instagram.com'})")

    else:
        st.info("まずは名前を入力してください")

# ==========================================
# Tab 2: 予定/実績ログ確認
# ==========================================
with tab2:
    st.markdown("### 過去ログ")
    start_date = st.date_input("開始日", value=date.today().replace(day=1))
    end_date = st.date_input("終了日", value=date.today())
    if 'user' in log_df.columns and USER:
        logs_filtered = log_df[(log_df['user']==USER) & 
                               (log_df['date'].dt.date >= start_date) & 
                               (log_df['date'].dt.date <= end_date)]
        st.dataframe(logs_filtered)
    else:
        st.info("ログがありません")

# ==========================================
# Tab 3: ジム管理
# ==========================================
with tab3:
    st.markdown("### ジムマスタ管理")
    new_gym_name = st.text_input("ジム名")
    new_gym_area = st.text_input("エリア")
    new_gym_url = st.text_input("Instagram URL")
    if st.button("ジムを追加"):
        gym_df.loc[len(gym_df)] = [new_gym_name, new_gym_area, new_gym_url]
        st.success(f"{new_gym_name} を登録しました")
    st.dataframe(gym_df)
