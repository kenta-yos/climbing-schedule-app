import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px
import pytz

# --- 日本時間の定義 ---
jp_timezone = pytz.timezone('Asia/Tokyo')
now_jp = datetime.now(jp_timezone)
today_jp = now_jp.date()

# --- 1. ページ設定 & CSS ---
st.set_page_config(page_title="Go Bouldering Pro", layout="centered")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1.5rem; }

    .insta-card {
        background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%);
        color: white; padding: 12px 15px; border-radius: 15px; text-align: center;
        margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .insta-val { font-size: 2.2rem; font-weight: 800; }
    .insta-label { font-size: 0.8rem; opacity: 0.9; }
    
    .item-box {
        display: grid !important;
        grid-template-columns: 4px 60px 1fr 40px !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 14px 0 !important;
        border-bottom: 1px solid #F0F0F0 !important;
        text-decoration: none !important;
    }

    .set-box {
        display: grid !important;
        grid-template-columns: 4px 105px 1fr !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 15px 5px !important;
        border-bottom: 1px solid #F0F0F0 !important;
        text-decoration: none !important;
        width: 100% !important;
    }

    .item-accent { width: 4px !important; height: 1.4rem !important; border-radius: 2px !important; flex-shrink: 0; }
    
    .item-date { 
        color: #B22222 !important; 
        font-weight: 700 !important; 
        font-size: 0.85rem !important; 
        white-space: nowrap !important; 
        display: inline-block !important; 
    }
    .item-gym { 
        color: #1A1A1A !important; 
        font-weight: 700 !important; 
        font-size: 0.95rem !important; 
        word-break: break-all !important;
        line-height: 1.3 !important;
    }
    
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }
    .past-opacity { opacity: 0.35 !important; }
    
    </style>
""", unsafe_allow_html=True)

# セッション状態の初期化
if 'ticks' not in st.session_state:
    st.session_state.ticks = {s: 0 for s in ["gym_master", "schedules", "climbing_logs", "users", "area_master"]}
if 'USER' not in st.session_state:
    st.session_state.USER = None

conn = st.connection("gsheets", type=GSheetsConnection)

# --- 2. データ読み込み (シート個別にキャッシュ管理) ---
def get_single_sheet(sheet_name):
    # tickを引数に含めることで、更新時だけキャッシュを破棄させる
    @st.cache_data(ttl=3600)
    def _read_with_cache(name, tick):
        df = conn.read(worksheet=name, ttl=0)
        df.columns = [str(c).strip().lower() for c in df.columns]
        # 日付処理
        if name == "climbing_logs" and not df.empty and 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'], errors='coerce').dt.tz_localize(None)
        elif name == "schedules" and not df.empty:
            for col in ['start_date', 'end_date']:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce').dt.tz_localize(None)
        return df    
    return _read_with_cache(sheet_name, st.session_state.ticks[sheet_name])

# データの取得（ここで必要なシートだけをバラで取る）
gym_df = get_single_sheet("gym_master")
sched_df = get_single_sheet("schedules")
log_df = get_single_sheet("climbing_logs")
user_df = get_single_sheet("users")
area_master = get_single_sheet("area_master")

# --- 3. 保存・削除用関数（超軽量版） ---
def safe_save(worksheet, df_input, mode="add", target_tab=None, clear_keys=None):
    try:
        if df_input.empty:
            return

        # 1. 保存用データの準備（この時点ではリクエスト0）
        save_df = df_input.copy()
        for col in ['date', 'start_date', 'end_date']:
            if col in save_df.columns:
                save_df[col] = pd.to_datetime(save_df[col]).dt.strftime('%Y-%m-%d 00:00:00')

        # 2. 保存処理
        if mode == "add":
            # 【API節約】読み直さず、メモリ上の最新データ(キャッシュ)と合体
            # get_single_sheet はキャッシュが効いているのでリクエストが飛ばない
            current_df = get_single_sheet(worksheet) 
            final_df = pd.concat([current_df, save_df], ignore_index=True).drop_duplicates()
            conn.update(worksheet=worksheet, data=final_df)
        else:
            # 上書きモード（削除など）
            conn.update(worksheet=worksheet, data=save_df)

        # 3. 成功時のみ入力フォームをクリア（安心感のための処理）
        if clear_keys:
            for k in clear_keys:
                if k in st.session_state:
                    del st.session_state[k]
            if "rows" in st.session_state:
                st.session_state.rows = 1

        # 4. キャッシュ更新（次回読み込み時にスプシを見に行くフラグを立てる）
        st.session_state.ticks[worksheet] = datetime.now().timestamp()
        
        # 5. 成功フラグを立てる
        st.session_state["save_success_flag"] = True
        
        # 6. リロード
        params = {"user": st.session_state.USER}
        if target_tab: params["tab"] = target_tab
        st.query_params.from_dict(params)
        st.rerun()
        
    except Exception as e:
        # APIエラー（制限）が起きた場合はここで止まる
        st.error(f"⚠️ API制限またはエラーが発生しました。30秒ほど待ってから再度お試しください。: {e}")
    
# ユーザーログイン処理
saved_user = st.query_params.get("user")
if saved_user and not user_df.empty and st.session_state.USER is None:
    u_match = user_df[user_df['user'] == saved_user]
    if not u_match.empty:
        st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = u_match.iloc[0][['user', 'color', 'icon']]

if not st.session_state.get('USER'):
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        cols = st.columns(2)
        for i, (_, row) in enumerate(user_df.iterrows()):
            with cols[i % 2]:
                btn_key = f"l_{row['user']}"
                st.markdown(f"<style>div.stButton > button[key='{btn_key}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; font-weight:bold; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user']}", key=btn_key):
                    st.session_state.USER = row['user']
                    st.session_state.U_COLOR = row['color']
                    st.session_state.U_ICON = row['icon']
                    st.query_params["user"] = row['user']
                    st.rerun()
    st.stop()

# ログイン後の時間を固定
today_ts = pd.Timestamp(today_jp).replace(hour=0, minute=0, second=0, microsecond=0)

# --- 5. タブ表示 ---

col_title, col_btn = st.columns([0.7, 0.3])
with col_title:
    st.write(f"🧗 Let's Go Bouldering **{st.session_state.U_ICON} {st.session_state.USER}**")
with col_btn:
    if st.button("🔄 最新に更新", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

if st.session_state.get("save_success_flag"):
    st.success("成功✌️")
    # 一度表示したら消す（これ重要！）
    st.session_state["save_success_flag"] = False

# --- 5. タブ表示 ---
tab_titles = ["🏠 Top", "✨ ジム", "📊 マイページ", "👥 仲間", "📅 セット", "⚙️ 管理"]
query_tab = st.query_params.get("tab", "🏠 Top")
active_tab_idx = tab_titles.index(query_tab) if query_tab in tab_titles else 0
tabs = st.tabs(tab_titles)

# --- Tab 1: 🏠 Top (完成版) ---
with tabs[0]: 
    st.query_params["tab"] = "🏠 Top"
    st.subheader("🚀 クイック登録")

    # 1. フォームの外でリストを作成
    sorted_gym_names = []
    if not gym_df.empty and not area_master.empty:
        priority_order = ["都内・神奈川", "関東", "全国"]
        
        # 地域情報を紐付け
        merged_gyms = pd.merge(gym_df, area_master[['area_tag', 'major_area']], on='area_tag', how='left')
        
        for area in priority_order:
            # その地域に属するジムを抽出し、名前順に
            subset = merged_gyms[merged_gyms['major_area'] == area]
            gyms_in_this_area = sorted(subset['gym_name'].tolist())
            
            for g_name in gyms_in_this_area:
                # 【重要】まだリストに入っていないジムだけを追加（これで重複を防ぐ）
                if g_name not in sorted_gym_names:
                    sorted_gym_names.append(g_name)
        
        # 最後に、どこにも属さなかったジムを念のため追加
        all_gyms = gym_df['gym_name'].unique().tolist()
        others = sorted([g for g in all_gyms if g not in sorted_gym_names])
        sorted_gym_names.extend(others)
    else:
        sorted_gym_names = sorted(gym_df['gym_name'].tolist()) if not gym_df.empty else []
        
    # 2. フォームの開始
    with st.form("quick_log_form_v3", clear_on_submit=True):
        q_date = st.date_input("📅 日程", value=today_jp)
        
        with st.expander("🏢 ジムを選択してください", expanded=False):
            # 修正ポイント: options=sorted_gym_names (イコールは1つ)
            q_gym = st.radio(
                "ジム一覧",
                options=sorted_gym_names,
                index=None,
                label_visibility="collapsed",
                key="q_gym_radio_v3"
            )
        
        st.write("") 

        # 3. 送信ボタン (カラムで配置)
        c1, c2 = st.columns(2)
        btn_plan = c1.form_submit_button("✋ 登ります", use_container_width=True)
        btn_done = c2.form_submit_button("✊ 登りました", use_container_width=True)

        # 4. 登録処理
        if btn_plan or btn_done:
            if q_gym:
                t_type = '予定' if btn_plan else '実績'
                new_row = pd.DataFrame([[pd.to_datetime(q_date), q_gym, st.session_state.USER, t_type]], 
                                     columns=['date','gym_name','user','type'])
                # これだけでOK！
                safe_save("climbing_logs", new_row, mode="add", target_tab="🏠 Top")
            else:
                st.warning("ジムを選択してください")
    
# Tab 2: ✨ ジム (マスタ連動・ラジオボタン版)
with tabs[1]:
    st.query_params["tab"] = "✨ ジム"
    st.subheader("✨ おすすめ")
    
    target_date = st.date_input("ターゲット日", value=today_jp, key="tg_date")
    t_dt = pd.to_datetime(target_date).replace(tzinfo=None)

    # エリア選択のラジオボタン
    major_choice = st.radio("表示範囲", ["都内・神奈川", "関東", "全国"], horizontal=True, index=0)

    # マスタから対象タグを抽出
    if major_choice == "全国":
        allowed_tags = gym_df['area_tag'].unique().tolist() if not gym_df.empty else []
    else:
        allowed_tags = area_master[area_master['major_area'] == major_choice]['area_tag'].tolist()

    ranked_list = []
    if not gym_df.empty:
        for _, gym in gym_df.iterrows():
            # マスタにないエリアはスキップ
            if gym['area_tag'] not in allowed_tags:
                continue

            name, score, reasons = gym['gym_name'], 0, []
            
            # --- 1. 鮮度スコア（セット終了日基準） ---
            if not sched_df.empty:
                past_sets = sched_df[(sched_df['gym_name'] == name) & (sched_df['end_date'] <= t_dt)]
                if not past_sets.empty:
                    latest_end = past_sets['end_date'].max()
                    diff = (t_dt - latest_end).days
                    if 0 <= diff <= 7: 
                        score += 40
                        reasons.append(f"🔥 新セット({diff}日前完了)")
                    elif 8 <= diff <= 14: 
                        score += 30
                        reasons.append(f"✨ 準新セット({diff}日前完了)")

            # --- 2. 仲間スコア ---
            others = log_df[(log_df['gym_name'] == name) & (log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] == t_dt)] if not log_df.empty else pd.DataFrame()
            if not others.empty:
                score += (50 * len(others))
                reasons.append(f"👥 仲間{len(others)}名が予定")
                
            # --- 3. 実績スコア ---
            my_v = log_df[(log_df['gym_name'] == name) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')] if not log_df.empty else pd.DataFrame()
            if my_v.empty: 
                score += 10
                reasons.append("🆕 未訪問")
            else:
                last_v_days = (t_dt - my_v['date'].max()).days
                if last_v_days >= 30: 
                    score += 20
                    reasons.append(f"⌛ {last_v_days}日ぶり")

            ranked_list.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})
    
    # スコア上位6件を表示
    for gym in sorted(ranked_list, key=lambda x: x['score'], reverse=True)[:6]:
        tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
        st.markdown(f'<div class="gym-card"><a href="{gym["url"]}" target="_blank" style="color:#007bff; font-weight:700; text-decoration:none;">{gym["name"]}</a> <small>({gym["area"]})</small><div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)

    st.divider()
    g1, g2 = st.tabs(["🏢 訪問済", "🗺️ 未訪問"])
    visited_names = []
    if not log_df.empty:
        my_done_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
        visited_names = my_done_logs['gym_name'].unique().tolist()
        
    with g1: # 訪問済タブ
        if visited_names:
            # 日付でソート
            last_v_df = my_done_logs.groupby('gym_name')['date'].max().sort_values(ascending=False).reset_index()
            
            for _, row in last_v_df.iterrows():
                # --- ここを安全な書き方に変更 ---
                target_gym_name = row['gym_name']
                g_url = "#" # デフォルト
                
                if not gym_df.empty and 'gym_name' in gym_df.columns:
                    match = gym_df[gym_df['gym_name'] == target_gym_name]
                    if not match.empty and 'profile_url' in match.columns:
                        g_url = match['profile_url'].iloc[0]
                
                st.markdown(f'''
                    <div class="item-box">
                        <div class="item-accent" style="background:#007bff !important"></div>
                        <span class="item-date">{row["date"].strftime("%Y/%m/%d")}</span>
                        <span class="item-gym">
                            <a href="{g_url}" target="_blank" style="color:inherit; text-decoration:none;">{target_gym_name}</a>
                        </span>
                        <div></div>
                    </div>
                ''', unsafe_allow_html=True)

    with g2:
        # 1. gym_df が空でなく、かつ必要な列があるかチェック
        if not gym_df.empty and 'gym_name' in gym_df.columns:
            # 未訪問のジムを抽出
            unv = gym_df[~gym_df['gym_name'].isin(visited_names)].sort_values('gym_name')
            
            for _, row in unv.iterrows():
                # 列の存在を確認しながら値を取得
                g_name = row.get('gym_name', 'Unknown')
                g_url = row.get('profile_url', '#')
                
                st.markdown(f'''
                    <div class="item-box">
                        <div class="item-accent" style="background:#CCC !important"></div>
                        <span class="item-date">NEW</span>
                        <span class="item-gym">
                            <a href="{g_url}" target="_blank" style="color:inherit; text-decoration:none;">{g_name}</a>
                        </span>
                    </div>
                ''', unsafe_allow_html=True)
        else:
            st.info("ジム情報が読み込めませんでした。更新ボタンを押してみてください。")

# Tab 3: マイページ (Sunsetdark & インスタ風)
with tabs[2]:
    st.query_params["tab"] = "📊 マイページ"
    st.subheader("🗓️ 登る予定")
    my_plans = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] >= today_ts)].sort_values('date') if not log_df.empty else pd.DataFrame()
    for i, row in my_plans.iterrows():
        st.markdown(f'''
            <div class="item-box">
                <div class="item-accent" style="background:#4CAF50 !important"></div>
                <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                <div class="item-gym">{row["gym_name"]}</div>
            </div>
        ''', unsafe_allow_html=True)


        if st.button("🗑️ 削除", key=f"del_{i}"):
            # 現在の表示用 log_df から1行消したデータを作成
            new_log_df = log_df.drop(i)
            # mode="overwrite" で「これに差し替えて！」と命令する
            safe_save("climbing_logs", new_log_df, mode="overwrite", target_tab="📊 マイページ")
    
    st.subheader("📊 登った実績")
    st.divider()
    sc1, sc2 = st.columns(2)
    ms, me = sc1.date_input("開始", value=today_jp.replace(day=1)), sc2.date_input("終了", value=today_jp)
    my_p_res = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績') & (log_df['date'].dt.date >= ms) & (log_df['date'].dt.date <= me)] if not log_df.empty else pd.DataFrame()
    
    if not my_p_res.empty:
        st.markdown(f'<div class="insta-card"><div style="display: flex; justify-content: space-around;"><div><div class="insta-val">{len(my_p_res)}</div><div class="insta-label">Sessions</div></div><div><div class="insta-val">{my_p_res["gym_name"].nunique()}</div><div class="insta-label">Gyms</div></div></div></div>', unsafe_allow_html=True)
        counts = my_p_res['gym_name'].value_counts().reset_index(); counts.columns = ['gym_name', 'count']; counts = counts.sort_values('count', ascending=True)
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', color='count', color_continuous_scale='Sunsetdark')
        fig.update_traces(texttemplate='  <b>%{text}回</b>', textposition='outside', hoverinfo='none')
        fig.update_layout(showlegend=False, coloraxis_showscale=False, xaxis_visible=False, yaxis_title=None, margin=dict(t=10, b=10, l=120, r=50), height=max(150, 45 * len(counts)), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', dragmode=False)
        st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False, 'staticPlot': True})

    st.subheader("📝 詳細")
    for i, row in my_p_res.sort_values('date', ascending=False).iterrows():
        st.markdown(f'''
            <div class="item-box">
                <div class="item-accent" style="background:#4CAF50 !important"></div>
                <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                <div class="item-gym">{row["gym_name"]}</div>
            </div>
        ''', unsafe_allow_html=True)
        if st.button("🗑️ 削除", key=f"del_{i}"):
            # 現在の表示用 log_df から1行消したデータを作成
            new_log_df = log_df.drop(i)
            # mode="overwrite" で「これに差し替えて！」と命令する
            safe_save("climbing_logs", new_log_df, mode="overwrite", target_tab="📊 マイページ")

# --- Tab 4: 👥 仲間 ---
with tabs[3]:
    st.query_params["tab"] = "👥 仲間"
    st.subheader("👥 予定一覧 (直近1ヶ月)")
    
    # 1. 自分を含めるかどうかのチェックボックス
    include_me = st.checkbox("自分の予定も表示する", value=False)
    
    # 2. データの抽出
    if not log_df.empty:
        # 基本条件：予定であること ＆ 未来の予定であること
        condition = (log_df['type'] == '予定') & \
                    (log_df['date'] >= today_ts) & \
                    (log_df['date'] <= today_ts + timedelta(days=30))
        
        # 「自分を含めない」がオン（デフォルト）の場合のみ、自分を除外する条件を追加
        if not include_me:
            condition = condition & (log_df['user'] != st.session_state.USER)
            
        o_plans = log_df[condition].sort_values('date')
        
        # 3. 表示ループ
        if not o_plans.empty:
            for _, row in o_plans.iterrows():
                # ユーザー情報の取得（色やアイコン）
                u = user_df[user_df['user'] == row['user']].iloc[0] if not user_df.empty and row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
                
                # 自分の名前の横には (自分) と表示して分かりやすくする
                display_name = f"{row['user']} (自分)" if row['user'] == st.session_state.USER else row['user']
                
                st.markdown(f'''
                    <div class="item-box">
                        <div class="item-accent" style="background:{u["color"]} !important"></div>
                        <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                        <span class="item-gym">
                            <b>{u["icon"]} {display_name}</b> 
                            <span style="font-size:0.8rem; color:#666; margin-left:8px;">@{row["gym_name"]}</span>
                        </span>
                    </div>
                ''', unsafe_allow_html=True)
        else:
            st.info("予定はありません。")
    else:
        st.info("データがありません。")
        
# Tab 5: 📅 セット (月選択 & Grid)
with tabs[4]:
    st.query_params["tab"] = "📅 セット"
    st.subheader("📅 セットスケジュール")
    if not sched_df.empty:
        s_df = sched_df.copy()
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=months, index=months.index(cur_m) if cur_m in months else 0)
        
        for _, row in s_df[s_df['month_year'] == sel_m].sort_values('start_date').iterrows():
            is_past = row['end_date'].date() < today_jp
            d_s = row['start_date'].strftime('%m/%d')
            d_e = row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            
            # <a>タグの中に直接 <div> と <span> を配置（余計な改行が入らないように一行で記述）
            st.markdown(f'''
                <a href="{row["post_url"]}" target="_blank" class="set-box {"past-opacity" if is_past else ""}">
                    <div class="item-accent" style="background:#B22222 !important"></div>
                    <span class="item-date">{d_disp}</span>
                    <span class="item-gym">{row["gym_name"]}</span>
                </a>
            ''', unsafe_allow_html=True)

# Tab 6: ⚙️ 管理
with tabs[5]:
    st.query_params["tab"] = "⚙️ 管理"    
    st.subheader("⚙️ 管理")

    # --- 🆕 ジム登録 ---
    with st.expander("🆕 ジム登録"):
        with st.form("adm_gym", clear_on_submit=True):
            n = st.text_input("ジム名")
            u = st.text_input("Instagram URL")
            a = st.text_input("エリア")
            if st.form_submit_button("登録"):
                if n and a:
                    new_gym = pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])
                    safe_save("gym_master", new_gym, mode="add")
                else:
                    st.warning("ジム名とエリアは必須です")

    # --- 📅 セット一括登録 ---
    with st.expander("📅 セット一括登録"):
        # セレクトボックスの選択肢を先に用意
        if not gym_df.empty:
            gym_options = sorted(gym_df['gym_name'].tolist())
        else:
            gym_options = []

        sel_g = st.selectbox(
            "対象ジム", 
            options=gym_options, 
            index=None, 
            placeholder="ジムを選択してください",
            key="admin_sel_gym"
        )
            
        p_url = st.text_input("告知URL", key="admin_post_url")
        
        if "rows" not in st.session_state: 
            st.session_state.rows = 1
            
        d_list = []
        for i in range(st.session_state.rows):
            c1, c2 = st.columns(2)
            sd = c1.date_input(f"開始 {i+1}", key=f"sd_{i}")
            ed = c2.date_input(f"終了 {i+1}", key=f"ed_{i}")
            d_list.append((sd, ed))
            
        col_btn1, col_btn2 = st.columns(2)
        if col_btn1.button("➕ 日程追加"): 
            st.session_state.rows += 1
            st.rerun()
            
        if col_btn2.button("🚀 一括登録"):
            if sel_g:
                new_s = pd.DataFrame(
                    [[sel_g, d[0], d[1], p_url] for d in d_list], 
                    columns=['gym_name', 'start_date', 'end_date', 'post_url']
                )
                st.session_state.rows = 1
                keys_to_clear = ["admin_sel_gym", "admin_post_url"] + [f"sd_{i}" for i in range(20)] + [f"ed_{i}" for i in range(20)]
                for k in keys_to_clear:
                    if k in st.session_state:
                        del st.session_state[k]
                safe_save("schedules", new_s, mode="add")
            else:
                st.error("ジムを選択してください")

    # --- 🚪 ログアウト ---
    st.write("")
    if st.button("🚪 ログアウト", use_container_width=True): 
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
