import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date
import plotly.express as px

st.set_page_config(page_title="セット管理Pro Next", layout="centered")

# --- CSS ---
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
.main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }
.gym-row-pro { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #EEE; }
.gym-name-link { color: #1A1A1A; font-weight: 700; font-size: 1rem; text-decoration: none; }
.tag-item { background: #F0F0F0; color: #666; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-right: 4px; }
.tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; }
.insta-card { background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); color: white; padding: 15px; border-radius: 15px; text-align: center; margin-bottom: 15px; }
.insta-val { font-size: 1.8rem; font-weight: 800; }
.log-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #F8F8F8; }
.log-date { color: #B22222; font-weight: 700; font-size: 0.8rem; width: 45px; }
</style>
""", unsafe_allow_html=True)

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_data():
    try:
        gyms = conn.read(worksheet="gym_master", ttl=0)
        schedules = conn.read(worksheet="schedules", ttl=0)
        logs = conn.read(worksheet="climbing_logs", ttl=0)
        # 列名の空白削除
        for df in [gyms, schedules, logs]:
            df.columns = df.columns.str.strip()
        return gyms, schedules, logs
    except:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

gym_df, schedule_df, log_df = load_data()

# --- 日付変換と無効データ除去 ---
if not schedule_df.empty:
    schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'], errors='coerce')
    schedule_df = schedule_df.dropna(subset=['start_date'])

if not log_df.empty:
    log_df['date'] = pd.to_datetime(log_df['date'], errors='coerce')
    log_df = log_df.dropna(subset=['date'])

# --- ユーザー管理 ---
if 'USER' not in st.session_state: st.session_state.USER = ""
if not st.session_state.USER:
    u = st.text_input("名前を入力（例：ケンジ）")
    if u: st.session_state.USER = u; st.rerun()
    st.stop()
USER = st.session_state.USER

# --- スコア計算 ---
def calculate_scores(gym_df, schedule_df, log_df, user):
    if gym_df.empty: return []
    today = datetime.now()
    results = []
    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score, reasons = 0, []

        # 新セット判定
        if not schedule_df.empty:
            gs = schedule_df[schedule_df['gym_name']==name]
            if not gs.empty:
                ds = (today - gs['start_date'].max()).days
                if ds <= 7: score += 50; reasons.append(f"🔥 新セット({ds}日前)")
                elif ds <= 14: score += 25; reasons.append("✨ 準新セット")

        # 実績判定
        if not log_df.empty:
            ml = log_df[(log_df['gym_name']==name) & (log_df['type']=='実績') & (log_df['user']==user)]
            if not ml.empty:
                dv = (today - ml['date'].max()).days
                if dv >= 30: score += 30; reasons.append(f"⌛ {dv}日ぶり")
            else:
                score += 30; reasons.append("🆕 未訪")

            fr = log_df[(log_df['gym_name']==name) & (log_df['type']=='予定') & (log_df['date'].dt.date==date.today())]
            if not fr.empty:
                score += 10 * len(fr)
                reasons.append(f"👥 {len(fr)}人の予定")

        results.append({
            "name": name,
            "score": score,
            "reasons": reasons,
            "area": gym.get('area_tag',''),
            "url": gym.get('profile_url','')
        })
    return sorted(results, key=lambda x: x['score'], reverse=True)

# --- タブ構成 ---
tab1, tab2, tab3, tab4 = st.tabs(["🏠 Today", "📅 Logs/予定", "📊 分析", "⚙️ Admin"])

# ==========================================
# Tab 1: Today（おすすめ & 登録）
# ==========================================
with tab1:
    st.markdown("### :dart: 今日のおすすめジム")
    ranked = calculate_scores(gym_df, schedule_df, log_df, USER)
    top2 = ranked[:2] if ranked else []
    if not top2: st.info("まずは⚙️ Adminからジムを登録してください。")
    
    for gym in top2:
        st.markdown(f'<div class="gym-row-pro"><div class="gym-info-main"><a href="{gym["url"]}" target="_blank" class="gym-name-link">{gym["name"]} <small style="font-weight:400;color:#888;">({gym["area"]})</small></a><div class="gym-tags">{" ".join([f"<span class="tag-item {'tag-hot' if "🔥" in r else ''}">{r}</span>" for r in gym["reasons"]])}</div></div></div>', unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            if st.button(f"✋ 行く", key=f"p_{gym['name']}"):
                new = pd.DataFrame([[date.today().isoformat(), gym['name'], USER, '予定']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True))
                st.rerun()
        with c2:
            if st.button(f"✅ 登った", key=f"l_{gym['name']}"):
                new = pd.DataFrame([[date.today().isoformat(), gym['name'], USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True))
                st.rerun()

# ==========================================
# Tab 2: Logs/予定（一覧＆登録）
# ==========================================
with tab2:
    st.markdown("### 📋 ログ & 予定登録")
    if gym_df.empty:
        st.info("⚙️ Adminからジムを登録してください。")
    else:
        gym_choice = st.selectbox("ジムを選択", gym_df['gym_name'].tolist())
        c1, c2 = st.columns(2)
        with c1:
            if st.button("✋ 登るよ", key=f"plan_{gym_choice}"):
                new = pd.DataFrame([[date.today().isoformat(), gym_choice, USER, '予定']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True))
                st.success(f"{gym_choice} に予定登録しました！"); st.rerun()
        with c2:
            if st.button("✅ 登った", key=f"log_{gym_choice}"):
                new = pd.DataFrame([[date.today().isoformat(), gym_choice, USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True))
                st.success(f"{gym_choice} を記録しました！"); st.rerun()

    # 過去ログ表示
    st.markdown("### 🕒 過去ログ")
    if not log_df.empty:
        user_logs = log_df[log_df['user']==USER].sort_values('date', ascending=False)
        for _, row in user_logs.iterrows():
            st.markdown(f'<div class="log-item"><div class="log-date">{row["date"].strftime("%m/%d")}</div><div>{row["gym_name"]} ({row["type"]})</div></div>', unsafe_allow_html=True)
    else:
        st.caption("まだ記録がありません。")

# ==========================================
# Tab 3: 分析
# ==========================================
with tab3:
    st.markdown("### 📊 実績分析")
    df_res = log_df[(log_df['type']=='実績') & (log_df['user']==USER)] if not log_df.empty else pd.DataFrame()
    c1, c2 = st.columns(2)
    with c1: st.markdown(f'<div class="insta-card"><div class="insta-label">Total</div><div class="insta-val">{len(df_res)}</div></div>', unsafe_allow_html=True)
    with c2: st.markdown(f'<div class="insta-card"><div class="insta-label">Gyms</div><div class="insta-val">{df_res["gym_name"].nunique() if not df_res.empty else 0}</div></div>', unsafe_allow_html=True)

    if not df_res.empty:
        counts = df_res['gym_name'].value_counts().reset_index().head(7)
        counts.columns = ['gym_name','count']
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', color='count', color_continuous_scale='Sunsetdark')
        fig.update_layout(showlegend=False, coloraxis_showscale=False, xaxis_visible=False, yaxis_title=None, height=250, margin=dict(t=0,b=0,l=100,r=40), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.warning("実績データがまだありません。「登った」ボタンで記録しましょう！")

# ==========================================
# Tab 4: Admin（ジム・セット管理）
# ==========================================
with tab4:
    st.write(f"Login: {USER}")
    with st.expander("➕ 新規追加"):
        m = st.radio("種別", ["ジム","セット"], horizontal=True)
        if m=="ジム":
            with st.form("gf"):
                n = st.text_input("ジム名"); a = st.text_input("エリア"); u = st.text_input("URL")
                if st.form_submit_button("登録"):
                    new = pd.DataFrame([[n,u,a]], columns=['gym_name','profile_url','area_tag'])
                    conn.update(worksheet="gym_master", data=pd.concat([gym_df,new], ignore_index=True)); st.success("登録完了"); st.rerun()
        else:
            with st.form("sf"):
                gn = st.selectbox("ジム", gym_df['gym_name'].tolist()) if not gym_df.empty else st.text_input("ジム名")
                sd = st.date_input("開始日"); p = st.text_input("URL")
                if st.form_submit_button("登録"):
                    new = pd.DataFrame([[gn, sd.isoformat(), sd.isoformat(), p]], columns=['gym_name','start_date','end_date','post_url'])
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df,new], ignore_index=True)); st.success("登録完了"); st.rerun()
