import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px

# --- ページ設定 ---
st.set_page_config(page_title="Go Bouldering", layout="centered")

# --- 究極のスマホ最適化・カラー反映CSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }
    
    /* おすすめジムのカード */
    .gym-card {
        padding: 15px; background: #FFF; border-radius: 12px;
        border: 1px solid #E9ECEF; margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .gym-title { font-size: 1.1rem; font-weight: 700; color: #1A1A1A; text-decoration: none; }
    .gym-area { font-size: 0.75rem; color: #888; margin-left: 8px; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; font-weight: 500; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }

    /* リストアイテム (Grid) */
    .item-box {
        display: grid; grid-template-columns: 4px 50px 30px 1fr;
        align-items: center; gap: 10px; padding: 12px 0;
        border-bottom: 1px solid #F8F8F8; text-decoration: none;
    }
    .item-accent { width: 4px; height: 1.2rem; border-radius: 2px; }
    .item-date { font-size: 0.8rem; font-weight: 700; color: #B22222; }
    .item-icon { font-size: 1rem; text-align: center; }
    .item-text { font-size: 0.9rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .past-opacity { opacity: 0.35; }

    /* インスタ風カード */
    .insta-card {
        background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%);
        color: white; padding: 15px; border-radius: 15px; text-align: center; margin-bottom: 20px;
    }
    .insta-val { font-size: 2rem; font-weight: 800; }
    </style>
""", unsafe_allow_html=True)

# --- データ取得・同期 ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    try:
        gyms = conn.read(worksheet="gym_master", ttl=0)
        sched = conn.read(worksheet="schedules", ttl=0)
        logs = conn.read(worksheet="climbing_logs", ttl=0)
        users = conn.read(worksheet="users", ttl=0)
        for df in [gyms, sched, logs, users]: df.columns = df.columns.str.strip()
        # 日付変換
        sched['start_date'] = pd.to_datetime(sched['start_date'])
        logs['date'] = pd.to_datetime(logs['date'])
        return gyms, sched, logs, users
    except Exception as e:
        st.error(f"データ読み込みエラー: {e}")
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

gym_df, sched_df, log_df, user_df = load_data()

# --- 認証（ユーザー選択） ---
if 'USER' not in st.session_state: st.session_state.USER = None

if not st.session_state.USER:
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        # 名前とアイコンを合体させたリストを作成（例： "🧗 Kenta"）
        user_options = {f"{row['icon']} {row['user']}": row['user'] for _, row in user_df.iterrows()}
        
        display_name = st.selectbox(
            "自分を選択してください", 
            options=list(user_options.keys())
        )
        
        # 選択されたユーザーの詳細情報を取得
        target_user_name = user_options[display_name]
        u_info = user_df[user_df['user'] == target_user_name].iloc[0]
        u_color = u_info['color']
        u_icon = u_info['icon']

        # ボタンにも個別のカラーを反映（CSSインジェクション）
        st.markdown(f"""
            <style>
            div.stButton > button:first-child {{
                background-color: {u_color};
                color: white;
                border: none;
                font-weight: bold;
                width: 100%;
                height: 3rem;
                border-radius: 10px;
            }}
            </style>
        """, unsafe_allow_html=True)

        if st.button(f"{u_icon} {target_user_name} としてログイン"):
            st.session_state.USER = target_user_name
            st.session_state.U_COLOR = u_color
            st.session_state.U_ICON = u_icon
            st.rerun()
    else:
        st.warning("usersシートにデータがありません。スプレッドシートを確認してください。")
    st.stop()

MY_NAME = st.session_state.USER
MY_ICON = st.session_state.U_ICON

# --- タブ構成 ---
tab1, tab2, tab3, tab4, tab5 = st.tabs(["🏠 Top", "📊 ログ", "📅 セット", "👥 仲間", "⚙️ 管理"])

# ==========================================
# Tab 1: 🏠 Top
# ==========================================
with tab1:
    col_a, col_b = st.columns(2)
    with col_a:
        target_date = st.date_input("ターゲット日", value=date.today())
    with col_b:
        areas = ["すべて"] + sorted(gym_df['area_tag'].unique().tolist())
        sel_area = st.selectbox("エリア絞り込み", areas)

    # スコア計算ロジック
    def get_ranked_gyms(target_d):
        target_dt = pd.to_datetime(target_d)
        results = []
        for _, gym in gym_df.iterrows():
            name = gym['gym_name']
            if sel_area != "すべて" and gym['area_tag'] != sel_area: continue
            
            score, reasons = 0, []
            # 1. 新セット判定
            if not sched_df.empty:
                g_sched = sched_df[sched_df['gym_name'] == name]
                if not g_sched.empty:
                    latest_set = g_sched['start_date'].max()
                    days_diff = (target_dt - latest_set).days
                    if 0 <= days_diff <= 7: score += 50; reasons.append(f"🔥 新セット({days_diff}日前)")
                    elif 0 <= days_diff <= 14: score += 25; reasons.append("✨ 準新セット")

            # 2. 自分の訪問履歴
            my_logs = log_df[(log_df['gym_name'] == name) & (log_df['user'] == MY_NAME) & (log_df['type'] == '実績')]
            if not my_logs.empty:
                last_v = my_logs['date'].max()
                days_since = (target_dt - last_v).days
                if days_since >= 30: score += 30; reasons.append(f"⌛ {days_since}日ぶり")
            else:
                score += 30; reasons.append("🆕 未訪")

            # 3. 仲間の予定
            others_plan = log_df[(log_df['gym_name'] == name) & (log_df['user'] != MY_NAME) & 
                                 (log_df['type'] == '予定') & (log_df['date'] == target_dt)]
            if not others_plan.empty:
                p_count = len(others_plan)
                score += (15 * p_count)
                friends = "".join(others_plan['user'].map(lambda x: user_df[user_df['user']==x]['icon'].iloc[0] if x in user_df['user'].values else "👤"))
                reasons.append(f"👥 {friends} {p_count}名の予定")

            results.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})
        return sorted(results, key=lambda x: x['score'], reverse=True)

    st.subheader("💡 おすすめのジム")
    ranked = get_ranked_gyms(target_date)
    for gym in ranked[:5]:
        with st.container():
            tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
            st.markdown(f'''
                <div class="gym-card">
                    <a href="{gym['url']}" target="_blank" class="gym-title">{gym['name']}</a>
                    <span class="gym-area">{gym['area']}</span>
                    <div class="tag-container">{tag_html}</div>
                </div>
            ''', unsafe_allow_html=True)
            
            c1, c2, c3 = st.columns(3)
            # 既存予定のチェック
            has_plan = not log_df[(log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == MY_NAME) & (log_df['type'] == '予定')].empty
            
            with c1:
                if st.button(f"✋ 登るよ", key=f"plan_{gym['name']}"):
                    new_row = pd.DataFrame([[target_date.isoformat(), gym['name'], MY_NAME, "予定"]], columns=['date','gym_name','user','type'])
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_row], ignore_index=True)); st.rerun()
            with c2:
                if st.button(f"✅ 登った", key=f"done_{gym['name']}"):
                    new_row = pd.DataFrame([[target_date.isoformat(), gym['name'], MY_NAME, "実績"]], columns=['date','gym_name','user','type'])
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_row], ignore_index=True)); st.rerun()
            with c3:
                if has_plan:
                    if st.button(f"🔄 変換", key=f"conv_{gym['name']}", help="予定を実績に変更"):
                        updated_df = log_df[~((log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == MY_NAME) & (log_df['type'] == '予定'))]
                        new_row = pd.DataFrame([[target_date.isoformat(), gym['name'], MY_NAME, "実績"]], columns=['date','gym_name','user','type'])
                        conn.update(worksheet="climbing_logs", data=pd.concat([updated_df, new_row], ignore_index=True)); st.rerun()

    st.markdown("---")
    st.subheader("🏢 ジム一覧（ご無沙汰順）")
    # Last訪問日の計算
    last_v_map = {}
    if not log_df.empty:
        my_done = log_df[(log_df['user'] == MY_NAME) & (log_df['type'] == '実績')]
        if not my_done.empty:
            last_v_map = my_done.groupby('gym_name')['date'].max().dt.strftime('%Y/%m/%d').to_dict()
    
    # 未訪問を最優先、あとは古い順
    sorted_gym_list = sorted(gym_df['gym_name'].tolist(), key=lambda x: last_v_map.get(x, "0000/00/00"))
    for gname in sorted_gym_list:
        lv = last_v_map.get(gname, "未訪問")
        url = gym_df[gym_df['gym_name']==gname]['profile_url'].iloc[0]
        st.markdown(f'''
            <a href="{url}" target="_blank" class="gym-row" style="display:flex; justify-content:space-between; padding:12px; background:#F8F9FA; border-radius:8px; margin-bottom:6px; text-decoration:none; color:inherit; border:1px solid #EEE;">
                <span style="font-weight:700;">{gname}</span>
                <span style="color:#888; font-size:0.8rem;">Last: {lv}</span>
            </a>
        ''', unsafe_allow_html=True)

# ==========================================
# Tab 2: 📊 ログ
# ==========================================
with tab2:
    my_res = log_df[(log_df['user'] == MY_NAME) & (log_df['type'] == '実績')].sort_values('date', ascending=False)
    
    # 統計カード
    c1, c2 = st.columns(2)
    with c1: st.markdown(f'<div class="insta-card">Session<br><span class="insta-val">{len(my_res)}</span></div>', unsafe_allow_html=True)
    with c2: st.markdown(f'<div class="insta-card">Gyms<br><span class="insta-val">{my_res["gym_name"].nunique() if not my_res.empty else 0}</span></div>', unsafe_allow_html=True)

    if not my_res.empty:
        counts = my_res['gym_name'].value_counts().reset_index().head(7)
        counts.columns = ['gym_name', 'count']
        fig = px.bar(counts.sort_values('count'), x='count', y='gym_name', orientation='h', color='count', color_continuous_scale='Sunsetdark')
        fig.update_layout(xaxis_visible=False, yaxis_title=None, height=250, margin=dict(t=0,b=0,l=100,r=20), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', showlegend=False)
        st.plotly_chart(fig, use_container_width=True, config={'staticPlot': True})

        st.subheader("履歴")
        for i, row in my_res.iterrows():
            cc1, cc2 = st.columns([4, 1])
            cc1.markdown(f'<div class="item-box"><div class="item-accent" style="background:{st.session_state.U_COLOR}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{MY_ICON}</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
            if cc2.button("🗑️", key=f"del_{i}"):
                updated_log = log_df.drop(i)
                conn.update(worksheet="climbing_logs", data=updated_log); st.rerun()

# ==========================================
# Tab 3: 📅 セットスケジュール
# ==========================================
with tab3:
    if not sched_df.empty:
        s_df = sched_df.sort_values('start_date', ascending=False)
        for _, row in s_df.iterrows():
            is_past = row['start_date'].date() < target_date
            st.markdown(f'''
                <a href="{row['post_url']}" target="_blank" class="item-box {'past-opacity' if is_past else ''}">
                    <div class="item-accent" style="background:#B22222"></div>
                    <div class="item-date">{row["start_date"].strftime("%m/%d")}</div>
                    <div class="item-icon">🗓️</div>
                    <div class="item-text">{row["gym_name"]}</div>
                </a>
            ''', unsafe_allow_html=True)

# ==========================================
# Tab 4: 👥 仲間
# ==========================================
with tab4:
    st.subheader("直近1ヶ月の予定")
    one_month_later = pd.to_datetime(target_date) + timedelta(days=30)
    # ターゲット日以降の全ユーザーの「予定」を抽出
    f_plans = log_df[(log_df['type'] == '予定') & (log_df['date'] >= pd.to_datetime(target_date)) & (log_df['date'] <= one_month_later)].sort_values('date')
    
    if not f_plans.empty:
        for _, row in f_plans.iterrows():
            u_info = user_df[user_df['user'] == row['user']].iloc[0] if row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
            gym_info = gym_df[gym_df['gym_name'] == row['gym_name']].iloc[0] if row['gym_name'] in gym_df['gym_name'].values else {"profile_url": "#"}
            
            st.markdown(f'''
                <a href="{gym_info['profile_url']}" target="_blank" class="item-box">
                    <div class="item-accent" style="background:{u_info['color']}"></div>
                    <div class="item-date">{row["date"].strftime("%m/%d")}</div>
                    <div class="item-icon">{u_info['icon']}</div>
                    <div class="item-text"><b>{row['user']}</b> @ {row['gym_name']}</div>
                </a>
            ''', unsafe_allow_html=True)
    else:
        st.caption("現在、仲間の予定はありません。")

# ==========================================
# Tab 5: ⚙️ 管理
# ==========================================
with tab5:
    st.write(f"Logged in as: {MY_ICON} {MY_NAME}")
    if st.button("ログアウト"): st.session_state.USER = None; st.rerun()
    
    with st.expander("➕ ジム・スケジュールの登録"):
        mode = st.radio("登録種別", ["ジムマスタ", "セットスケジュール"], horizontal=True)
        if mode == "ジムマスタ":
            with st.form("gym_form"):
                n = st.text_input("ジム名")
                a = st.text_input("エリアタグ (例: 新宿)")
                u = st.text_input("Instagram URL")
                if st.form_submit_button("ジムを登録"):
                    new_g = pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])
                    conn.update(worksheet="gym_master", data=pd.concat([gym_df, new_g], ignore_index=True)); st.rerun()
        else:
            with st.form("sched_form"):
                sel_g = st.selectbox("ジム", gym_df['gym_name'].tolist())
                s_date = st.date_input("セット開始日")
                p_url = st.text_input("告知URL")
                if st.form_submit_button("スケジュールを登録"):
                    new_s = pd.DataFrame([[sel_g, s_date.isoformat(), s_date.isoformat(), p_url]], columns=['gym_name','start_date','end_date','post_url'])
                    conn.update(worksheet="schedules", data=pd.concat([sched_df, new_s], ignore_index=True)); st.rerun()
