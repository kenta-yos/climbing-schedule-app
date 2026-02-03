import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta

st.set_page_config(page_title="セット管理Pro Next", layout="centered")

# --- スコア設定（重み） ---
SCORE_NEW_SET = 50      # セット直後（1週間以内）
SCORE_LONG_ABSENCE = 30 # 30日以上行っていない
SCORE_FRIENDS = 10      # 仲間が今日行く予定（1人あたり）

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    gyms = conn.read(worksheet="gym_master")
    schedules = conn.read(worksheet="schedules")
    logs = conn.read(worksheet="climbing_logs")
    return gyms, schedules, logs

gym_df, schedule_df, log_df = load_data()

# 日付型に変換
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
log_df['date'] = pd.to_datetime(log_df['date'])

# --- スコアリングエンジン ---
def calculate_gym_scores(gym_df, schedule_df, log_df):
    today = datetime.now()
    scores = []

    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score = 0
        reasons = []

        # 1. セット情報（最新のセット完了日を確認）
        gym_sched = schedule_df[schedule_df['gym_name'] == name]
        if not gym_sched.empty:
            latest_set = gym_sched['start_date'].max()
            days_since_set = (today - latest_set).days
            if days_since_set <= 7:
                score += SCORE_NEW_SET
                reasons.append(f"🔥 新セット（{days_since_set}日前）")
            elif days_since_set <= 14:
                score += (SCORE_NEW_SET // 2)
                reasons.append("✨ セットから2週間以内")

        # 2. 自分の履歴（最後に行った日）
        # ※本来はログインユーザーで絞り込み
        my_logs = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '実績')]
        if not my_logs.empty:
            last_visit = my_logs['date'].max()
            days_since_visit = (today - last_visit).days
            if days_since_visit >= 30:
                score += SCORE_LONG_ABSENCE
                reasons.append(f":hourglass: {days_since_visit}日ぶりの再訪チャンス")
        else:
            score += SCORE_LONG_ABSENCE # 未訪も加点
            reasons.append(":new: 初訪問チャンス")

        # 3. 仲間の予定
        friends_today = log_df[(log_df['gym_name'] == name) & 
                               (log_df['type'] == '予定') & 
                               (log_df['date'].dt.date == date.today())]
        if not friends_today.empty:
            score += (SCORE_FRIENDS * len(friends_today))
            reasons.append(f":busts_in_silhouette: 仲間が{len(friends_today)}人行く予定")

        scores.append({
            "gym_name": name,
            "total_score": score,
            "reasons": reasons,
            "area": gym.get('area_tag', '不明'),
            "url": gym.get('profile_url', '')
        })
    
    return sorted(scores, key=lambda x: x['total_score'], reverse=True)

# --- UI: Todayビュー ---
st.title("Today's Best Choice")
st.subheader("今日、どこ行く？")

ranked_gyms = calculate_gym_scores(gym_df, schedule_df, log_df)

for gym in ranked_gyms:
    with st.container():
        # スコアが高いものを強調
        border_color = "#FF512F" if gym['total_score'] >= 50 else "#F0F2F6"
        
        st.markdown(f"""
            <div style="border: 2px solid {border_color}; padding: 15px; border-radius: 15px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.2rem; font-weight: 800;">{gym['gym_name']}</span>
                    <span style="font-size: 0.8rem; color: #888;">{gym['area']}</span>
                </div>
                <div style="margin: 10px 0;">
                    {' '.join([f'<span style="background: #FFF0F0; color: #FF512F; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-right: 5px;">{r}</span>' for r in gym['reasons']])}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <a href="{gym['url']}" target="_blank" style="text-decoration: none; flex: 1; text-align: center; background: #eee; color: #333; padding: 5px; border-radius: 5px; font-size: 0.8rem;">Instagram</a>
                </div>
            </div>
        """, unsafe_allow_html=True)

# --- 簡易ナビゲーション ---
st.sidebar.title("メニュー")
mode = st.sidebar.radio("切り替え", ["Todayビュー", "予定/ログを登録", "管理"])
