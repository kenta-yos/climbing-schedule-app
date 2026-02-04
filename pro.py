import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px

# --- 1. ページ設定 & CSS定義 ---
st.set_page_config(page_title="Go Bouldering", layout="centered")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }
    
    /* カード・タグ */
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .gym-title { font-size: 1.1rem; font-weight: 700; color: #1A1A1A !important; text-decoration: none !important; }
    .gym-link { color: #007bff !important; text-decoration: none !important; font-weight: 600; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; font-weight: 500; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }

    /* Gridリスト（仕様書：3カラム/4カラム構造） */
    .item-box { display: grid; grid-template-columns: 4px 60px 30px 1fr; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #F8F8F8; text-decoration: none !important; }
    .item-accent { width: 4px; height: 1.2rem; border-radius: 2px; background: #B22222; }
    .item-date { font-size: 0.8rem; font-weight: 700; color: #B22222; }
    .item-icon { font-size: 1rem; text-align: center; }
    .item-text { font-size: 0.9rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .past-opacity { opacity: 0.35; }

    /* 分析カード（インフルエンサー風） */
    .insta-card { background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); color: white; padding: 15px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
    .insta-val { font-size: 2rem; font-weight: 800; }
    </style>
""", unsafe_allow_html=True)

# --- 2. データ接続 & 読み込み ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    try:
        gyms = conn.read(worksheet="gym_master", ttl=1).dropna(how='all')
        sched = conn.read(worksheet="schedules", ttl=1).dropna(how='all')
        logs = conn.read(worksheet="climbing_logs", ttl=1).dropna(how='all')
        users = conn.read(worksheet="users", ttl=1).dropna(how='all')
        for df in [gyms, sched, logs, users]:
            df.columns = [str(c).strip().lower() for c in df.columns]
        if not sched.empty: sched['start_date'] = pd.to_datetime(sched['start_date'], errors='coerce')
        if not logs.empty: logs['date'] = pd.to_datetime(logs['date'], errors='coerce')
        return gyms, sched, logs, users
    except:
        st.warning("API制限中...1分待ってください")
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

gym_df, sched_df, log_df, user_df = load_data()

# --- 3. セッション & 認証 (仕様書準拠) ---
if 'USER' not in st.session_state: st.session_state.USER = None

# 自動ログイン（URLパラメータ）
if st.session_state.USER is None and "user" in st.query_params:
    u_match = user_df[user_df['user'] == st.query_params["user"]]
    if not u_match.empty:
        st.session_state.USER = u_match.iloc[0]['user']
        st.session_state.U_COLOR = u_match.iloc[0]['color']
        st.session_state.U_ICON = u_match.iloc[0]['icon']

if not st.session_state.USER:
    st.title("🧗 Go Bouldering")
    st.subheader("ユーザーを選択")
    if not user_df.empty:
        cols = st.columns(2)
        for i, (_, row) in enumerate(user_df.iterrows()):
            with cols[i % 2]:
                st.markdown(f"<style>div.stButton > button[key='l_{row['user']}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user']}", key=f"l_{row['user']}"):
                    st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = row['user'], row['color'], row['icon']
                    st.query_params["user"] = row['user']
                    st.rerun()
    st.stop()

# --- 4. メインタブ構成 ---
tab1, tab2, tab3, tab4, tab5 = st.tabs(["🏠 Top", "📊 ログ", "📅 セット", "👥 仲間", "⚙️ 管理"])

# ==========================================
# Tab 1: 🏠 Top（提案 & 記録）
# ==========================================
with tab1:
    st.subheader("🎯 今日のプラン")
    c1, c2 = st.columns(2)
    with c1: target_date = st.date_input("ターゲット日", value=date.today())
    with c2: 
        areas = ["すべて"] + sorted(gym_df['area_tag'].unique().tolist()) if not gym_df.empty else ["すべて"]
        sel_area = st.selectbox("エリア絞り込み", areas)

    def calculate_scores(t_date):
        t_dt = pd.to_datetime(t_date)
        res = []
        for _, gym in gym_df.iterrows():
            if sel_area != "すべて" and gym['area_tag'] != sel_area: continue
            name, score, reasons = gym['gym_name'], 0, []
            
            # 1. セット判定 (Hot)
            if not sched_df.empty:
                g_s = sched_df[sched_df['gym_name'] == name]['start_date'].dropna()
                if not g_s.empty:
                    diff = (t_dt - g_s.max()).days
                    if 0 <= diff <= 7: score += 50; reasons.append(f"🔥 新セット({diff}日前)")
                    elif 0 <= diff <= 14: score += 25; reasons.append("✨ 準新セット")

            # 2. 訪問判定
            my_v = log_df[(log_df['gym_name'] == name) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
            if my_v.empty: score += 30; reasons.append("🆕 未訪問")
            else:
                v_diff = (t_dt - my_v['date'].max()).days
                if v_diff >= 30: score += 30; reasons.append(f"⌛ {v_diff}日ぶり")

            # 3. 仲間
            others = log_df[(log_df['gym_name'] == name) & (log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] == t_dt)]
            if not others.empty:
                score += (15 * len(others))
                icons = "".join([user_df[user_df['user']==u]['icon'].iloc[0] for u in others['user'] if u in user_df['user'].values])
                reasons.append(f"👥 {icons} {len(others)}名の予定")

            res.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})
        return sorted(res, key=lambda x: x['score'], reverse=True)

    # おすすめ表示
    ranked = calculate_scores(target_date)
    for gym in ranked[:3]:
        with st.container():
            tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
            st.markdown(f'<div class="gym-card"><a href="{gym["url"]}" target="_blank" class="gym-title">{gym["name"]}</a> <small style="color:#888;">({gym["area"]})</small><div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)
            cc1, cc2, cc3 = st.columns(3)
            # 予定の有無確認
            has_plan = not log_df[(log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定')].empty
            
            if cc1.button("✋ 登るぜ", key=f"p_{gym['name']}"):
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '予定']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
            if cc2.button("✅ 登った", key=f"r_{gym['name']}"):
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
            if has_plan and cc3.button("🔄 変換", key=f"c_{gym['name']}"):
                base = log_df[~((log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定'))]
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([base, new], ignore_index=True)); st.cache_data.clear(); st.rerun()

    st.markdown("---")
    v_tab1, v_tab2 = st.tabs(["🏢 訪問済", "🗺️ 未訪問"])
    my_done = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
    visited_names = my_done['gym_name'].unique().tolist()
    gym_url_map = gym_df.set_index('gym_name')['profile_url'].to_dict()

    with v_tab1:
        if visited_names:
            last_v = my_done.groupby('gym_name')['date'].max().sort_values() # 古い順
            for g, d in last_v.items():
                st.markdown(f'<div class="item-box"><div class="item-accent"></div><div class="item-date">{d.strftime("%m/%d")}</div><div class="item-icon">📍</div><div class="item-text"><a href="{gym_url_map.get(g,"#")}" target="_blank" class="gym-link">{g}</a></div></div>', unsafe_allow_html=True)
    with v_tab2:
        unvisited = gym_df[~gym_df['gym_name'].isin(visited_names)].sort_values('gym_name')
        for _, row in unvisited.iterrows():
            st.markdown(f'<div class="item-box"><div class="item-accent" style="background:#CCC"></div><div class="item-date">NEW</div><div class="item-icon">🗺️</div><div class="item-text"><a href="{row["profile_url"]}" target="_blank" class="gym-link">{row["gym_name"]}</a> <small>({row["area_tag"]})</small></div></div>', unsafe_allow_html=True)

# ==========================================
# Tab 2: 📊 ログ（分析 & 履歴）
# ==========================================
with tab2:
    st.subheader("分析 & 履歴")
    c1, c2 = st.columns(2)
    with c1: s_date = st.date_input("開始", value=date.today().replace(day=1))
    with c2: e_date = st.date_input("終了", value=date.today())
    
    my_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['date'].dt.date >= s_date) & (log_df['date'].dt.date <= e_date)].sort_values('date', ascending=False)
    my_res = my_logs[my_logs['type'] == '実績']
    
    ca, cb = st.columns(2)
    ca.markdown(f'<div class="insta-card">Total Sessions<br><span class="insta-val">{len(my_res)}</span></div>', unsafe_allow_html=True)
    cb.markdown(f'<div class="insta-card">Visited Gyms<br><span class="insta-val">{my_res["gym_name"].nunique() if not my_res.empty else 0}</span></div>', unsafe_allow_html=True)

    if not my_res.empty:
        counts = my_res['gym_name'].value_counts().reset_index()
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', color_discrete_sequence=['#DD2476'])
        fig.update_layout(xaxis_visible=False, yaxis_title=None, height=200, margin=dict(t=0,b=0,l=100,r=40), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        st.plotly_chart(fig, use_container_width=True)

    for i, row in my_logs.iterrows():
        cc1, cc2 = st.columns([5, 1])
        cc1.markdown(f'<div class="item-box"><div class="item-accent" style="background:{"#B22222" if row["type"]=="実績" else "#FFD700"}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{"✅" if row["type"]=="実績" else "✋"}</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
        if cc2.button("🗑️", key=f"del_{i}"):
            conn.update(worksheet="climbing_logs", data=log_df.drop(i)); st.cache_data.clear(); st.rerun()

# ==========================================
# Tab 3: 📅 セットスケジュール
# ==========================================
with tab3:
    st.subheader("セットスケジュール")
    if not sched_df.empty:
        for _, row in sched_df.sort_values('start_date', ascending=False).iterrows():
            if pd.isna(row['start_date']): continue
            is_past = row['start_date'].date() < target_date
            st.markdown(f'<a href="{row.get("post_url","#")}" target="_blank" class="item-box {"past-opacity" if is_past else ""}"><div class="item-accent"></div><div class="item-date">{row["start_date"].strftime("%m/%d")}</div><div class="item-icon">🗓️</div><div class="item-text">{row["gym_name"]}</div></a>', unsafe_allow_html=True)

# ==========================================
# Tab 4: 👥 仲間（スケジュール共有）
# ==========================================
with tab4:
    st.subheader("仲間の予定 (直近1ヶ月)")
    limit_dt = pd.to_datetime(target_date) + timedelta(days=30)
    # ターゲット日より過去は非表示（仕様書準拠）
    others = log_df[(log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] >= pd.to_datetime(target_date)) & (log_df['date'] <= limit_dt)].sort_values('date')
    for _, row in others.iterrows():
        u_info = user_df[user_df['user'] == row['user']].iloc[0] if row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
        st.markdown(f'<div class="item-box"><div class="item-accent" style="background:{u_info["color"]}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{u_info["icon"]}</div><div class="item-text"><b>{row["user"]}</b> @ {row["gym_name"]}</div></div>', unsafe_allow_html=True)

# ==========================================
# Tab 5: ⚙️ 管理
# ==========================================
with tab5:
    st.subheader("データ管理")
    with st.expander("🆕 ジム登録"):
        with st.form("gym_reg"):
            n, u, a = st.text_input("ジム名"), st.text_input("Instagram URL"), st.text_input("エリアタグ")
            if st.form_submit_button("登録"):
                new = pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])
                conn.update(worksheet="gym_master", data=pd.concat([gym_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
                
    with st.expander("📅 セット登録"):
        # 複数日程対応ロジック
        selected_gym = st.selectbox("対象ジム", gym_df['gym_name'].tolist()) if not gym_df.empty else ""
        post_url = st.text_input("告知URL")
        
        if "sched_rows" not in st.session_state: st.session_state.sched_rows = 1
        
        dates_to_add = []
        for i in range(st.session_state.sched_rows):
            c1, c2 = st.columns(2)
            with c1: sd = st.date_input(f"開始日 {i+1}", key=f"sd_{i}")
            with c2: ed = st.date_input(f"終了日 {i+1}", key=f"ed_{i}")
            dates_to_add.append((sd, ed))
            
        if st.button("➕ 日程を追加"):
            st.session_state.sched_rows += 1
            st.rerun()
            
        if st.button("🚀 この内容で一括登録"):
            new_list = []
            for sd, ed in dates_to_add:
                new_list.append([selected_gym, sd.isoformat(), ed.isoformat(), post_url])
            new_df = pd.DataFrame(new_list, columns=['gym_name','start_date','end_date','post_url'])
            conn.update(worksheet="schedules", data=pd.concat([sched_df, new_df], ignore_index=True))
            st.session_state.sched_rows = 1
            st.cache_data.clear(); st.rerun()

    st.markdown("---")
    if st.button("🚪 ログアウト"):
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
