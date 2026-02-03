import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date
import calendar
import plotly.express as px

st.set_page_config(page_title="セット管理Pro Next", layout="centered")

# --- 究極のスマホ最適化CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }

    /* サマリーカード */
    .insta-card {
        background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%);
        color: white; padding: 12px 15px; border-radius: 15px; text-align: center;
        margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .insta-val { font-size: 1.8rem; font-weight: 800; }
    .insta-label { font-size: 0.75rem; opacity: 0.9; }

    /* コンパクト・リスト構造 */
    .gym-row-pro {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #EEE;
        text-decoration: none;
    }
    .gym-info-main { flex-grow: 1; }
    .gym-name-link {
        color: #1A1A1A; font-weight: 700; font-size: 1rem;
        text-decoration: none; display: block; margin-bottom: 4px;
    }
    .gym-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag-item {
        background: #F0F0F0; color: #666; font-size: 0.65rem;
        padding: 2px 6px; border-radius: 4px;
    }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; }
    
    /* ログ表示用 */
    .log-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 0; border-bottom: 1px solid #F8F8F8;
    }
    .log-date { color: #B22222; font-weight: 700; font-size: 0.8rem; width: 45px; }
    .log-gym { font-weight: 500; color: #333; font-size: 0.9rem; }
    .log-user { color: #888; font-size: 0.75rem; background: #F5F5F5; padding: 1px 5px; border-radius: 3px; }

    /* ボタン調整 */
    div.stButton > button {
        width: 100%; border-radius: 8px; font-size: 0.8rem; height: 35px;
        padding: 0; background-color: #F8F9FA;
    }
    </style>
    """, unsafe_allow_html=True)

# --- スコア設定 ---
SCORE_NEW_SET = 50
SCORE_LONG_ABSENCE = 30
SCORE_FRIENDS = 10

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_data():
    gyms = conn.read(worksheet="gym_master", ttl=0)
    schedules = conn.read(worksheet="schedules", ttl=0)
    logs = conn.read(worksheet="climbing_logs", ttl=0)
    gyms.columns = gyms.columns.str.strip()
    schedules.columns = schedules.columns.str.strip()
    logs.columns = logs.columns.str.strip()
    return gyms, schedules, logs

gym_df, schedule_df, log_df = load_data()
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
log_df['date'] = pd.to_datetime(log_df['date'])

# --- ユーザー管理 ---
if 'USER' not in st.session_state: st.session_state.USER = ""
if not st.session_state.USER:
    u = st.text_input("名前を入力")
    if u: st.session_state.USER = u; st.rerun()
    st.stop()
USER = st.session_state.USER

# --- スコア計算 ---
def calculate_scores(gym_df, schedule_df, log_df, user):
    today = datetime.now()
    results = []
    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score, reasons = 0, []
        
        # セット
        gs = schedule_df[schedule_df['gym_name'] == name]
        if not gs.empty:
            ds = (today - gs['start_date'].max()).days
            if ds <= 7: score += SCORE_NEW_SET; reasons.append(f"🔥 新セット({ds}日前)")
            elif ds <= 14: score += 25; reasons.append("✨ 準新セット")
        
        # 履歴
        ml = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '実績') & (log_df['user'] == user)]
        if not ml.empty:
            dv = (today - ml['date'].max()).days
            if dv >= 30: score += SCORE_LONG_ABSENCE; reasons.append(f"⌛ {dv}日ぶり")
        else: score += SCORE_LONG_ABSENCE; reasons.append("🆕 未訪")
        
        # 仲間
        fr = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '予定') & (log_df['date'].dt.date == date.today())]
        if not fr.empty:
            score += (SCORE_FRIENDS * len(fr))
            reasons.append(f"👥 {len(fr)}人の予定")

        results.append({"name": name, "score": score, "reasons": reasons, "area": gym.get('area_tag',''), "url": gym.get('profile_url','')})
    return sorted(results, key=lambda x: x['score'], reverse=True)

# --- タブ ---
tab1, tab2, tab3 = st.tabs(["🏠 Today", "📊 Logs", "⚙️ Admin"])

# ==========================================
# Tab 1: Todayビュー
# ==========================================
with tab1:
    st.markdown(f"### おすすめ（{USER}）")
    ranked = calculate_scores(gym_df, schedule_df, log_df, USER)
    
    for gym in ranked[:10]:
        # リスト形式UI
        st.markdown(f"""
            <div class="gym-row-pro">
                <div class="gym-info-main">
                    <a href="{gym['url']}" target="_blank" class="gym-name-link">{gym['name']} <small style="font-weight:400;color:#888;">({gym['area']})</small></a>
                    <div class="gym-tags">
                        {' '.join([f'<span class="tag-item {"tag-hot" if "🔥" in r else ""}">{r}</span>' for r in gym['reasons']])}
                    </div>
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        c1, c2 = st.columns(2)
        with c1:
            if st.button(f"✋ 行く", key=f"p_{gym['name']}"):
                new = pd.DataFrame([[date.today().isoformat(), gym['name'], USER, '予定']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.rerun()
        with c2:
            if st.button(f"✅ 登った", key=f"l_{gym['name']}"):
                new = pd.DataFrame([[date.today().isoformat(), gym['name'], USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.rerun()

# ==========================================
# Tab 2: ログ/予定
# ==========================================
with tab2:
    # --- 実績サマリー (棒グラフ) ---
    st.markdown("### 実績分析")
    today = date.today()
    start_q = today.replace(day=1) # 今月初め
    df_res = log_df[log_df['type'] == '実績'].copy()
    if not df_res.empty:
        # グラフ用集計
        counts = df_res['gym_name'].value_counts().reset_index()
        counts.columns = ['gym_name', 'count']
        fig = px.bar(counts.head(5), x='count', y='gym_name', orientation='h', 
                     text='count', color='count', color_continuous_scale='Sunsetdark')
        fig.update_layout(showlegend=False, coloraxis_showscale=False, xaxis_visible=False, yaxis_title=None,
                          height=200, margin=dict(t=0, b=0, l=100, r=40), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        st.plotly_chart(fig, use_container_width=True, config={'staticPlot': True})

    # --- 予定リスト ---
    st.markdown("### 🏃 今後の予定")
    plans = log_df[(log_df['type'] == '予定') & (log_df['date'].dt.date >= date.today())].sort_values('date')
    if plans.empty: st.caption("予定はありません")
    for _, row in plans.iterrows():
        st.markdown(f"""
            <div class="log-item">
                <div class="log-date">{row['date'].strftime('%m/%d')}</div>
                <div class="log-gym">{row['gym_name']}</div>
                <div class="log-user">{row['user']}</div>
            </div>
        """, unsafe_allow_html=True)

    # --- 最近の実績リスト ---
    st.markdown("### ✅ 最近の実績")
    done = log_df[log_df['type'] == '実績'].sort_values('date', ascending=False).head(10)
    for _, row in done.iterrows():
        st.markdown(f"""
            <div class="log-item" style="opacity: 0.8;">
                <div class="log-date">{row['date'].strftime('%m/%d')}</div>
                <div class="log-gym">{row['gym_name']}</div>
                <div class="log-user">{row['user']}</div>
            </div>
        """, unsafe_allow_html=True)

# ==========================================
# Tab 3: 管理
# ==========================================
with tab3:
    with st.expander("ジム登録"):
        with st.form("g"):
            n = st.text_input("ジム名"); a = st.text_input("エリア"); u = st.text_input("Insta URL")
            if st.form_submit_button("保存"):
                new = pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])
                conn.update(worksheet="gym_master", data=pd.concat([gym_df, new], ignore_index=True)); st.rerun()
    
    with st.expander("セット登録"):
        with st.form("s"):
            gn = st.selectbox("ジム", gym_df['gym_name'].tolist())
            sd = st.date_input("開始日")
            if st.form_submit_button("保存"):
                new = pd.DataFrame([[gn, sd.isoformat(), sd.isoformat(), ""]], columns=['gym_name','start_date','end_date','post_url'])
                conn.update(worksheet="schedules", data=pd.concat([schedule_df, new], ignore_index=True)); st.rerun()
