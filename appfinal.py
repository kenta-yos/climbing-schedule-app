simport streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import plotly.express as px
import pytz
import uuid
import time
from st_supabase_connection import SupabaseConnection

# --- 日本時間の定義 ---
jp_timezone = pytz.timezone('Asia/Tokyo')
now_jp = datetime.now(jp_timezone)
today_jp = now_jp.date()

# --- 1. ページ設定 & CSS (変更なし) ---
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
    .item-date { color: #B22222 !important; font-weight: 700 !important; font-size: 0.85rem !important; white-space: nowrap !important; display: inline-block !important; }
    .item-gym { color: #1A1A1A !important; font-weight: 700 !important; font-size: 0.95rem !important; word-break: break-all !important; line-height: 1.3 !important; }
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }
    .past-opacity { opacity: 0.35 !important; }
    </style>
""", unsafe_allow_html=True)

# セッション状態の初期化
if 'USER' not in st.session_state:
    st.session_state.USER = None

# --- 2. Supabase 接続設定 ---
conn = st.connection("supabase", type=SupabaseConnection)

def get_supabase_data(table_name):
    """詳細なエラー表示付きのデータ読み込み"""
    @st.cache_data(ttl=10) # テストのため一旦10秒キャッシュに短縮
    def _read(name):
        try:
            # .select("*") の後に .execute() を実行
            res = conn.table(name).select("*").execute()
            
            # デバッグ用にレスポンスの生データを表示（成功したら消します）
            if not res.data:
                st.info(f"Supabaseからの返り値が空です (Table: {name})")
                return pd.DataFrame()
            
            df = pd.DataFrame(res.data)
            
            # 日付型の列を変換
            date_cols = ['date', 'start_date', 'end_date', 'created_at']
            for col in date_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col]).dt.tz_localize(None)
            return df
        except Exception as e:
            st.error(f"テーブル {name} の読み込み中にエラーが発生しました:\n{e}")
            return pd.DataFrame()
            
    return _read(table_name)

# データの取得
gym_df = get_supabase_data("gym_master")
sched_df = get_supabase_data("set_schedules") # テーブル名を合わせました
log_df = get_supabase_data("climbing_logs")
user_df = get_supabase_data("users")
area_master = get_supabase_data("area_master")

# --- 3. 保存・削除処理 (Supabase版) ---
FEEDBACK = {
    "add":    {"msg": "登録したよ🚀"},
    "delete": {"msg": "削除したよ🙆‍♂️"},
    "error":  {"msg": "⚠️失敗しちゃった"}
}

def safe_save(table: str, data_input, mode: str = "add", target_tab: str = None):
    """
    data_input: 
      - mode="add" の時は pd.DataFrame
      - mode="delete" の時は id (文字列)
    """
    try:
        if mode == "add":
            if data_input.empty:
                return
            
            # 辞書形式に変換
            data_to_insert = data_input.to_dict(orient="records")
            
            for d in data_to_insert:
                # 1. IDはSupabase側に任せるのがベスト（もし辞書にあれば消す、なければそのまま）
                #    ※手動でIDを指定して上書きしたい場合を除き、自動生成に任せます。
                
                # 2. 日付・時刻型を文字列に統一
                for key in ['date', 'start_date', 'end_date']:
                    if key in d and hasattr(d[key], 'isoformat'):
                        d[key] = d[key].isoformat()
            
            conn.table(table).insert(data_to_insert).execute()

        elif mode == "delete":
            # data_input は IDそのもの
            conn.table(table).delete().eq("id", data_input).execute()

        # 共通処理
        st.cache_data.clear()
        
        # リロード後の画面で表示するためにセッションに保存
        fb = FEEDBACK.get(mode, FEEDBACK["add"])
        st.session_state.toast_msg = fb["msg"]
        
        # リダイレクト設定
        params = {"user": st.session_state.USER}
        if target_tab: 
            params["tab"] = target_tab
        st.query_params.update(params) # from_dictよりupdateの方が柔軟です
        
        st.rerun()

    except Exception as e:
        st.error(f"⚠️ エラー: {e}")
        
# --- ユーザー情報表示用のヘルパー関数 ---
def get_user_badge(user_name, user_df):
    u_info = user_df[user_df['user_name'] == user_name] if not user_df.empty else pd.DataFrame()
    if not u_info.empty:
        color = u_info.iloc[0]['color']
        icon = u_info.iloc[0]['icon']
    else:
        color = "#666"
        icon = "👤"
    return f'<span style="background:{color}; color:white; padding:2px 8px; border-radius:12px; font-size:0.8rem; margin-right:4px; font-weight:bold;">{icon} {user_name}</span>'

def get_colored_user_text(user_name, user_df_input):
    u_color = "#555555"
    u_icon = "👤"
    
    if user_df_input is not None and not user_df_input.empty:
        match = user_df_input[user_df_input['user_name'] == user_name]
        if not match.empty:
            u_color = match.iloc[0]['color']
            u_icon = match.iloc[0]['icon']

    # text-shadowを使って白縁取りを行い、視認性を最大化
    style = (
        f"color: {u_color}; "
        f"font-weight: 800; "
        f"text-shadow: 1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff; "
        f"padding: 0 2px;"
    )
    return f'<span style="{style}">{u_icon}{user_name}</span>'
    
# --- 4. ログイン処理 (変更なし) ---
saved_user = st.query_params.get("user")
if saved_user and not user_df.empty and st.session_state.USER is None:
    u_match = user_df[user_df['user_name'] == saved_user]
    if not u_match.empty:
        st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = u_match.iloc[0][['user_name', 'color', 'icon']]

if not st.session_state.get('USER'):
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        cols = st.columns(2)
        sorted_user_df = user_df.sort_values("user_name")
        for i, (_, row) in enumerate(sorted_user_df.iterrows()):
            with cols[i % 2]:
                btn_key = f"l_{row['user_name']}"
                st.markdown(f"<style>div.stButton > button[key='{btn_key}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; font-weight:bold; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user_name']}", key=btn_key):
                    st.session_state.USER = row['user_name']
                    st.session_state.U_COLOR = row['color']
                    st.session_state.U_ICON = row['icon']
                    st.query_params["user"] = row['user_name']
                    st.rerun()
    st.stop()

# --- 5. メイン画面 ---
if "toast_msg" in st.session_state:
    st.toast(st.session_state.toast_msg)
    del st.session_state.toast_msg  # 1回出したら消す

today_ts = pd.Timestamp(today_jp)

col_title, col_btn = st.columns([0.7, 0.3])
with col_title: st.write(f"🧗 Let's Go Bouldering **{st.session_state.U_ICON} {st.session_state.USER}**")
with col_btn:
    if st.button("🔄 更新", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

tab_titles = ["🏠 Top", "✨ ジム", "📊 マイページ", "👥 仲間", "📅 セット", "⚙️ 管理"]
query_tab = st.query_params.get("tab", "🏠 Top")
active_tab_idx = tab_titles.index(query_tab) if query_tab in tab_titles else 0
tabs = st.tabs(tab_titles)

# --- Tab 1: 🏠 Top ---
with tabs[0]:
    st.query_params["tab"] = "🏠 Top"
    
    # 1. データの事前抽出（NameError防止のための初期設定）
    today_logs = pd.DataFrame()
    tomorrow_logs = pd.DataFrame()
    t_0 = pd.Timestamp(today_jp)
    t_1 = t_0 + timedelta(days=1)

    if not log_df.empty:
        # 予定（type='予定'）だけを抽出
        all_plans = log_df[log_df['type'] == '予定']
        if not all_plans.empty:
            today_logs = all_plans[all_plans['date'] == t_0]
            tomorrow_logs = all_plans[all_plans['date'] == t_1]

    # 2. 優先順位付きジムリストの作成 (復元)
    sorted_gym_names = []
    if not gym_df.empty and not area_master.empty:
        priority_order = ["都内・神奈川", "関東", "全国"]
        merged_gyms = pd.merge(gym_df, area_master[['area_tag', 'major_area']], on='area_tag', how='left')
        for area in priority_order:
            subset = merged_gyms[merged_gyms['major_area'] == area]
            gyms_in_this_area = sorted(subset['gym_name'].unique().tolist())
            for g_name in gyms_in_this_area:
                if g_name not in sorted_gym_names:
                    sorted_gym_names.append(g_name)
        
        all_gyms = gym_df['gym_name'].unique().tolist()
        others = sorted([g for g in all_gyms if g not in sorted_gym_names])
        sorted_gym_names.extend(others)
    else:
        sorted_gym_names = sorted(gym_df['gym_name'].unique().tolist()) if not gym_df.empty else []

    # 3. 登録フォーム
    st.subheader("🚀 クイック登録")
    with st.form("quick_log_form", clear_on_submit=True):
        q_date = st.date_input("📅 日程", value=today_jp)
        q_gym = st.selectbox("🏢 ジムを選択", options=sorted_gym_names, index=None, placeholder="ジム名を選択...")
        
        c1, c2 = st.columns(2)
        if c1.form_submit_button("✋ 登ります", use_container_width=True) and q_gym:
            new_row = pd.DataFrame([{'date': pd.to_datetime(q_date), 'gym_name': q_gym, 'user': st.session_state.USER, 'type': '予定'}])
            safe_save("climbing_logs", new_row, mode="add", target_tab="🏠 Top")
        if c2.form_submit_button("✊ 登りました", use_container_width=True) and q_gym:
            new_row = pd.DataFrame([{'date': pd.to_datetime(q_date), 'gym_name': q_gym, 'user': st.session_state.USER, 'type': '実績'}])
            safe_save("climbing_logs", new_row, mode="add", target_tab="🏠 Top")

    st.divider()
    
    # 3. シンプル1行表示
    st.markdown("##### 🔥 今日どこいくー？")
    if not today_logs.empty:
        # ジム名でグループ化してユーザーをリストにする
        grouped_today = today_logs.groupby('gym_name')['user'].apply(list).reset_index()
        for _, row in grouped_today.iterrows():
            gym = row['gym_name']
            unique_users = sorted(list(set(row['user'])))
            user_htmls = [get_colored_user_text(u, user_df) for u in unique_users]
            members_html = " & ".join(user_htmls)

            st.markdown(f'''
                <div style="margin-bottom: 8px; padding-left: 10px; border-left: 4px solid #4CAF50;">
                    <span style="font-weight: bold; color: #333;">{gym}</span>：{members_html}
                </div>
            ''', unsafe_allow_html=True)
    else:
        st.caption("誰もいないよ😭")

    st.markdown("##### 👀 明日どこいくー？")
    if not tomorrow_logs.empty:
        grouped_tom = tomorrow_logs.groupby('gym_name')['user'].apply(list).reset_index()
        for _, row in grouped_tom.iterrows():
            gym = row['gym_name']
            unique_users = sorted(list(set(row['user'])))
            user_htmls = [get_colored_user_text(u, user_df) for u in unique_users]
            members_html = " & ".join(user_htmls)

            st.markdown(f'''
                <div style="margin-bottom: 8px; padding-left: 10px; border-left: 4px solid #FF9800;">
                    <span style="font-weight: bold; color: #333;">{gym}</span>：{members_html}
                </div>
            ''', unsafe_allow_html=True)
    else:
        st.caption("誰もいないよ😭")
    
# Tab 2: 🏠 ジム (マスタ連動・高機能スコアリング版)
with tabs[1]:
    st.query_params["tab"] = "🏠 ジム"
    
    # 1. ターゲット設定
    st.subheader("✨ おすすめ")
    c_date1, c_date2 = st.columns([0.6, 0.4])
    target_date = c_date1.date_input("ターゲット日", value=today_jp, key="tg_date")
    # 比較用に型を Timestamp に統一
    t_dt = pd.Timestamp(target_date)

    # 2. エリア選択（ラジオボタン）
    major_choice = st.radio("表示範囲", ["都内・神奈川", "関東", "全国"], horizontal=True, index=0)

    # 3. マスタから対象エリアタグを抽出
    if major_choice == "全国":
        allowed_tags = gym_df['area_tag'].unique().tolist() if not gym_df.empty else []
    else:
        # area_master も取得済みであることが前提
        allowed_tags = area_master[area_master['major_area'] == major_choice]['area_tag'].tolist() if not area_master.empty else []

    # 4. ジムのスコアリング
    ranked_list = []
    if not gym_df.empty:
        for _, row in gym_df.iterrows():
            if row['area_tag'] not in allowed_tags:
                continue

            score = 0
            reasons = []
            
            # --- 1. データの準備（ここで変数を確実に定義する） ---
            # 自分の最終訪問日
            my_last_visit = log_df[
                (log_df['user'] == st.session_state.USER) & 
                (log_df['type'] == '実績') & 
                (log_df['gym_name'] == row['gym_name'])
            ]['date'].max() if not log_df.empty else None

            # ジムの新セット日（ここで確実に定義）
            new_set_dt = None
            if 'new_set_date' in row and pd.notnull(row['new_set_date']):
                try:
                    new_set_dt = pd.to_datetime(row['new_set_date'])
                except:
                    new_set_dt = None

            # --- 2. 加点ロジック：刺激が訪問より後か？ ---
            # A. 新セット加点
            if new_set_dt is not None:
                # 自分がそのセット替えの後に一度でも行ったかどうか
                if my_last_visit is None or new_set_dt > my_last_visit:
                    set_days = (t_dt - new_set_dt).days
                    
                    if 0 <= set_days <= 7:
                        score += 70
                        reasons.append("🔥超新セット!")
                    elif 7 < set_days <= 14:
                        score += 40
                        reasons.append("✨新セット")

            # B. 仲間加点
            others_today = log_df[
                (log_df['user'] != st.session_state.USER) & 
                (log_df['type'] == '予定') & 
                (log_df['date'].dt.date == target_date) &
                (log_df['gym_name'] == row['gym_name'])
            ] if not log_df.empty else pd.DataFrame()

            if not others_today.empty:
                score += 50
                reasons.append("👥 仲間あり")

            ranked_list.append({
                "name": row['gym_name'],
                "area": row['area_tag'],
                "url": row.get('instagram_url', '#'),
                "score": score,
                "reasons": reasons
            })
        
    # 5. スコア上位表示
    if ranked_list:
        # スコア上位6件
        sorted_gyms = sorted(ranked_list, key=lambda x: x['score'], reverse=True)[:6]
        
        for gym in sorted_gyms:
            # タグ生成（シンプル化：背景は淡い青、🔥や👥がある時だけ少し色を強調）
            tag_html = "".join([
                f'<span style="background:{"#fff0f0" if ("🔥" in r or "👥" in r) else "#f0f7ff"}; '
                f'color:{"#ff4b4b" if ("🔥" in r or "👥" in r) else "#007bff"}; '
                f'padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px; '
                f'border: 1px solid {"#ffdada" if ("🔥" in r or "👥" in r) else "#cce5ff"}; '
                f'font-weight: 600;">{r}</span>' 
                for r in gym['reasons']
            ])
            
            st.markdown(f'''
                <div style="
                    background: white; 
                    padding: 10px 14px; 
                    border-radius: 10px; 
                    border: 1px solid #f0f0f0; 
                    margin-bottom: 8px; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <a href="{gym["url"]}" target="_blank" style="color:#333; font-weight:700; text-decoration:none; font-size: 0.9rem;">
                            📸 {gym["name"]}
                        </a>
                        <span style="color: #999; font-size: 0.7rem; background: #f8f8f8; padding: 2px 6px; border-radius: 4px;">
                            📍 {gym["area"]}
                        </span>
                    </div>
                    <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 2px;">
                        {tag_html}
                    </div>
                </div>
            ''', unsafe_allow_html=True)
    else:
        st.info("条件に合うジムが見つかりません。")

    st.divider()

    # Tab 2: 🏢 ジム一覧
    with tabs[1]:
        st.query_params["tab"] = "🏢 ジム一覧"
        st.subheader("🏢 ジムライブラリ")
    
        if not gym_df.empty:
            # --- 1. データの準備（最新訪問日の算出） ---
            my_done_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')] if not log_df.empty else pd.DataFrame()
    
            # ジムごとに最新訪問日を辞書化
            last_visit_dict = {}
            if not my_done_logs.empty:
                last_visit_dict = my_done_logs.groupby('gym_name')['date'].max().to_dict()
    
            # 訪問済みと未訪問に分ける
            visited_list = []
            unvisited_list = []
    
            for _, row in gym_df.iterrows():
                gym_name = row['gym_name']
                # --- ここでリンク先をインスタURLに設定 ---
                insta_url = row.get('profile_url', '#') 
                
                gym_data = {
                    "name": gym_name,
                    "area": row['area_tag'],
                    "url": insta_url,
                    "last_date": last_visit_dict.get(gym_name)
                }
                if gym_name in last_visit_dict:
                    visited_list.append(gym_data)
                else:
                    unvisited_list.append(gym_data)
    
            # --- 2. 訪問済みを日付順にソート ---
            visited_list.sort(key=lambda x: x['last_date'], reverse=True)
    
            # --- 3. UI表示 ---
            g_tabs = st.tabs(["✅ 訪問済", "🔍 未訪問"])
    
            # スタイル定義（リンクの色味を少し調整）
            st.markdown("""
                <style>
                .gym-row { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding: 12px 0; 
                    border-bottom: 1px solid #f9f9f9; 
                    text-decoration: none !important; 
                }
                .gym-row:active { background-color: #fafafa; }
                .gym-info { display: flex; flex-direction: column; }
                .gym-n { font-size: 0.9rem; font-weight: 600; color: #1DA1F2; } /* リンクと分かるよう少し青めに */
                .gym-a { font-size: 0.7rem; color: #999; }
                .gym-d { font-size: 0.75rem; font-weight: 700; color: #4CAF50; background: #e8f5e9; padding: 2px 8px; border-radius: 4px; }
                </style>
            """, unsafe_allow_html=True)
    
            with g_tabs[0]: # 訪問済
                if not visited_list:
                    st.caption("まだ訪問実績がありません。")
                else:
                    for g in visited_list:
                        # ラベルを付けて、最後に行った日であることを強調
                        st.markdown(f'''
                            <a href="{g['url']}" target="_blank" class="gym-row">
                                <div class="gym-info">
                                    <span class="gym-n">📸 {g['name']}</span>
                                    <span class="gym-a">{g['area']}</span>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.6rem; color: #888; margin-bottom: -2px;">Last visit</div>
                                    <span class="gym-d">{g['last_date'].strftime("%Y/%m/%d")}</span>
                                </div>
                            </a>
                        ''', unsafe_allow_html=True)
                
            with g_tabs[1]: # 未訪問
                if not unvisited_list:
                    st.caption("すべてのジムを制覇しました！")
                else:
                    for g in unvisited_list:
                        st.markdown(f'''
                            <a href="{g['url']}" target="_blank" class="gym-row">
                                <div class="gym-info">
                                    <span class="gym-n">⬜ {g['name']}</span>
                                    <span class="gym-a">{g['area']}</span>
                                </div>
                                <span style="font-size: 0.7rem; color: #ccc;">未踏</span>
                            </a>
                        ''', unsafe_allow_html=True)
        else:
            st.info("ジムマスターが空です。管理タブから登録してください。")
    
# Tab 3: 📊 マイページ
with tabs[2]:
    st.query_params["tab"] = "📊 マイページ"
    
    # --- 1. 期間指定（実績の統計用） ---
    st.subheader("📊 統計・実績管理")
    sc1, sc2 = st.columns(2)
    ms = sc1.date_input("開始", value=today_jp.replace(day=1), key="stat_start")
    me = sc2.date_input("終了", value=today_jp, key="stat_end")
    
    ms_ts = pd.Timestamp(ms)
    me_ts = pd.Timestamp(me)

    # --- 2. データの抽出 ---
    if not log_df.empty:
        # 【実績】は期間で絞り込む
        filtered_done = log_df[
            (log_df['user'] == st.session_state.USER) & 
            (log_df['type'] == '実績') & 
            (log_df['date'] >= ms_ts) & 
            (log_df['date'] <= me_ts)
        ].sort_values('date', ascending=False)
        
        # 【予定】は期間に関係なく自分のものを全件出す
        all_my_plans = log_df[
            (log_df['user'] == st.session_state.USER) & 
            (log_df['type'] == '予定')
        ].sort_values('date') # 予定なので日付順
    else:
        filtered_done = pd.DataFrame()
        all_my_plans = pd.DataFrame()

    # --- 3. 統計グラフの表示（ここは実績ベース） ---
    if not filtered_done.empty:
        st.markdown(f'''
            <div class="insta-card">
                <div style="display: flex; justify-content: space-around;">
                    <div><div class="insta-val">{len(filtered_done)}</div><div class="insta-label">Sessions</div></div>
                    <div><div class="insta-val">{filtered_done["gym_name"].nunique()}</div><div class="insta-label">Gyms</div></div>
                </div>
            </div>
        ''', unsafe_allow_html=True)
        
        counts = filtered_done['gym_name'].value_counts().reset_index()
        counts.columns = ['gym_name', 'count']
        counts = counts.sort_values('count', ascending=True)
        
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', 
                     color='count', color_continuous_scale='Sunsetdark')
        fig.update_traces(texttemplate='  <b>%{text}回</b>', textposition='outside')
        fig.update_layout(
            showlegend=False, coloraxis_showscale=False, xaxis_visible=False, 
            yaxis_title=None, margin=dict(t=10, b=10, l=120, r=50), 
            height=max(150, 35 * len(counts)), paper_bgcolor='rgba(0,0,0,0)', 
            plot_bgcolor='rgba(0,0,0,0)', dragmode=False,            
        )
        
        st.markdown('<div style="pointer-events: none;">', unsafe_allow_html=True)
        st.plotly_chart(
            fig, 
            use_container_width=True, 
            config={
                'staticPlot': True,        # これが最強：グラフを完全に静止画にする
                'displayModeBar': False,   # 上のメニューも出さない
                'scrollZoom': False,
                'doubleClick': False,
                'showAxisDragHandles': False
            }
        )
        st.markdown('</div>', unsafe_allow_html=True)
        
    else:
        st.info("この期間の実績はまだありません。")

    st.divider()

    # --- 4. 予定と実績をタブで表示 ---
    st.subheader("📝 履歴管理（削除）")
    m_tabs = st.tabs(["📅 全ての予定", "✅ 期間内の実績"])

    # スタイルは共通
    st.markdown("""
        <style>
        .compact-row {
            display: grid;
            grid-template-columns: 4px 45px 1fr;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .compact-date { font-size: 0.8rem; font-weight: 700; color: #666; }
        .compact-gym { font-size: 0.85rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        </style>
    """, unsafe_allow_html=True)

    with m_tabs[0]: # 予定タブ：全期間
        if all_my_plans.empty:
            st.caption("予定はありません。")
        else:
            for _, row in all_my_plans.iterrows():
                c1, c2 = st.columns([0.85, 0.15])
                c1.markdown(f'''
                    <div class="compact-row">
                        <div style="background:#4CAF50; width:4px; height:1rem; border-radius:2px;"></div>
                        <span class="compact-date">{row["date"].strftime("%m/%d")}</span>
                        <div class="compact-gym">{row["gym_name"]}</div>
                    </div>
                ''', unsafe_allow_html=True)
                if c2.button("🗑️", key=f"del_p_{row['id']}"):
                    safe_save("climbing_logs", row['id'], mode="delete", target_tab="📊 マイページ")

    with m_tabs[1]: # 実績タブ：期間連動
        if filtered_done.empty:
            st.caption(f"{ms.strftime('%m/%d')}〜{me.strftime('%m/%d')} の実績はありません。")
        else:
            for _, row in filtered_done.iterrows():
                c1, c2 = st.columns([0.85, 0.15])
                c1.markdown(f'''
                    <div class="compact-row">
                        <div style="background:#DD2476; width:4px; height:1rem; border-radius:2px;"></div>
                        <span class="compact-date">{row["date"].strftime("%m/%d")}</span>
                        <div class="compact-gym">{row["gym_name"]}</div>
                    </div>
                ''', unsafe_allow_html=True)
                if c2.button("🗑️", key=f"del_d_{row['id']}"):
                    safe_save("climbing_logs", row['id'], mode="delete", target_tab="📊 マイページ")

# Tab 4: 👥 仲間 (Supabase連動・完全復元版)
with tabs[3]:
    st.query_params["tab"] = "👥 仲間"
    st.subheader("👥 仲間たちの予定 (直近30日)")
    
    # 1. 表示オプション
    include_me = st.checkbox("自分の予定も表示する", value=False, key="check_include_me")
    
    # 2. データの抽出
    if not log_df.empty:
        # 基本条件：予定であること ＆ 今日以降の予定であること
        # (SupabaseのdateはTimestamp型なので、today_jpをTimestampに変換して比較)
        lower_bound = pd.Timestamp(today_jp)
        upper_bound = lower_bound + timedelta(days=30)
        
        condition = (log_df['type'] == '予定') & \
                    (log_df['date'] >= lower_bound) & \
                    (log_df['date'] <= upper_bound)
        
        # 自分を含めない設定なら除外
        if not include_me:
            condition = condition & (log_df['user'] != st.session_state.USER)
            
        o_plans = log_df[condition].sort_values('date')
        
        # 3. 表示ループ
        if not o_plans.empty:
            for _, row in o_plans.iterrows():
                # ユーザー情報を users テーブルから取得 (user_name で紐付け)
                u_info = user_df[user_df['user_name'] == row['user']] if not user_df.empty else pd.DataFrame()
                
                if not u_info.empty:
                    u_color = u_info.iloc[0]['color']
                    u_icon = u_info.iloc[0]['icon']
                else:
                    # 万が一ユーザーが見つからない場合のデフォルト
                    u_color = "#CCC"
                    u_icon = "👤"
                
                # 自分自身の予定には目印をつける
                is_me = row['user'] == st.session_state.USER
                display_name = f"{row['user']} (自分)" if is_me else row['user']
                
                st.markdown(f'''
                    <div class="item-box">
                        <div class="item-accent" style="background:{u_color} !important"></div>
                        <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                        <span class="item-gym">
                            <span style="font-size:1.1rem; margin-right:4px;">{u_icon}</span>
                            <b style="color:{u_color if is_me else '#1A1A1A'};">{display_name}</b> 
                            <span style="font-size:0.8rem; color:#666; margin-left:8px;">@{row["gym_name"]}</span>
                        </span>
                        <div></div>
                    </div>
                ''', unsafe_allow_html=True)
        else:
            st.info("期間内に仲間の予定は見つかりませんでした。")
    else:
        st.info("データがありません。")

# Tab 5: 📅 セット (Supabase版・レイアウト修正)
with tabs[4]:
    st.query_params["tab"] = "📅 セット"
    st.subheader("📅 セットスケジュール")
    
    if not sched_df.empty:
        s_df = sched_df.copy()
        
        # 表示用の月リストを作成 (Timestamp型を考慮)
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        
        # 現在の月をデフォルト選択
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=months, index=months.index(cur_m) if cur_m in months else 0)
        
        # 選択された月のデータを表示
        target_month_df = s_df[s_df['month_year'] == sel_m].sort_values('start_date')
        
        for _, row in target_month_df.iterrows():
            # 日付の比較用に date 型に変換
            is_past = row['end_date'].date() < today_jp
            
            # 表示用の日付文字列を作成
            d_s = row['start_date'].strftime('%m/%d')
            d_e = row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            
            # レイアウト崩れ防止：HTML構造を整理
            st.markdown(f'''
                <a href="{row["post_url"]}" target="_blank" style="text-decoration: none;">
                    <div class="set-box {"past-opacity" if is_past else ""}" style="
                        display: grid;
                        grid-template-columns: 4px 105px 1fr;
                        align-items: center;
                        gap: 12px;
                        padding: 15px 5px;
                        border-bottom: 1px solid #F0F0F0;
                        width: 100%;
                    ">
                        <div class="item-accent" style="background:#B22222 !important; width: 4px; height: 1.4rem; border-radius: 2px;"></div>
                        <span class="item-date" style="color: #B22222; font-weight: 700; font-size: 0.85rem; white-space: nowrap;">{d_disp}</span>
                        <span class="item-gym" style="color: #1A1A1A; font-weight: 700; font-size: 0.95rem;">{row["gym_name"]}</span>
                    </div>
                </a>
            ''', unsafe_allow_html=True)
    else:
        st.info("セットスケジュールが登録されていません。")

# Tab 6: ⚙️ 管理 (セット一括登録・完全復活版)
with tabs[5]:
    st.query_params["tab"] = "⚙️ 管理"    
    st.subheader("⚙️ 管理メニュー")

    # --- 🆕 ジム登録 ---
    with st.expander("🆕 ジムの新規登録"):
        with st.form("adm_gym", clear_on_submit=True):
            n = st.text_input("ジム名（例: B-PUMP Ogikubo）")
            u = st.text_input("Instagram等のURL")
            a = st.text_input("エリアタグ（例: tokyo）")
            if st.form_submit_button("登録"):
                if n and a:
                    new_gym = pd.DataFrame([{'gym_name': n, 'profile_url': u, 'area_tag': a}])
                    safe_save("gym_master", new_gym, mode="add", target_tab="⚙️ 管理")
                else:
                    st.warning("ジム名とエリアは必須です")

    # --- 📅 セット一括登録 (復活) ---
    with st.expander("📅 セットスケジュール登録", expanded=True):
        
        # セレクトボックスの選択肢
        gym_options = sorted(gym_df['gym_name'].tolist()) if not gym_df.empty else []
        sel_g = st.selectbox(
            "対象ジム", 
            options=gym_options, 
            index=None, 
            placeholder="ジムを選択...",
            key="admin_sel_gym"
        )
            
        p_url = st.text_input("告知URL (Instagramなど)", key="admin_post_url")
        
        # 追加ボタンなどの状態管理
        if "rows" not in st.session_state: 
            st.session_state.rows = 1
            
        d_list = []
        for i in range(st.session_state.rows):
            c1, c2 = st.columns(2)
            # st.date_input の返り値は自動的に datetime.date 型になる
            sd = c1.date_input(f"開始 {i+1}", value=today_jp, key=f"sd_{i}")
            ed = c2.date_input(f"終了 {i+1}", value=today_jp, key=f"ed_{i}")
            d_list.append((sd, ed))
            
        col_btn1, col_btn2 = st.columns(2)
        if col_btn1.button("➕ 日程欄を追加"): 
            st.session_state.rows += 1
            st.rerun()
            
        if col_btn2.button("登録", use_container_width=True):
            if sel_g and p_url:
                new_s_list = []
                for d in d_list:
                    new_s_list.append({
                        'gym_name': sel_g,
                        'start_date': d[0].isoformat(), # date型を文字列へ
                        'end_date': d[1].isoformat(),
                        'post_url': p_url
                    })
                
                new_s_df = pd.DataFrame(new_s_list)
                
                # 入力欄をリセットするための処理
                st.session_state.rows = 1
                safe_save("set_schedules", new_s_df, mode="add", target_tab="📅 セット")
            else:
                st.error("ジムの選択と告知URLの入力は必須です。")

    # --- 🚪 ログアウト ---
    st.write("")
    if st.button("🚪 ログアウト", use_container_width=True): 
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
