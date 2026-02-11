import streamlit as st
import pandas as pd
from datetime import datetime
from datetime import timedelta
from utils import get_supabase_data, safe_save, get_now_jp, get_colored_user_text

def show_page():
    from datetime import timedelta
    
    # --- 初期定義 (元のコードそのまま) ---
    now_jp = get_now_jp()
    today_jp = now_jp.date()
    today_ts = pd.Timestamp(today_jp)
    this_month = today_jp.month
    
    # データの取得 (元のコードそのまま)
    gym_df = get_supabase_data("gym_master")
    sched_df = get_supabase_data("set_schedules")
    log_df = get_supabase_data("climbing_logs")
    user_df = get_supabase_data("users")
    area_master = get_supabase_data("area_master")
    
    # --- 1. ログイン処理 (元のコードそのまま) ---
    if not st.session_state.get('USER'):
        st.markdown("<h2 style='text-align: center; margin-top: 2rem;'>🧗 Go Bouldering</h2>", unsafe_allow_html=True)
        st.write("") # 少し余白
        
        # 💡 このCSSが「横並びコンテナ」を真ん中に寄せます
        st.markdown("""
            <style>
            [data-testid="stHorizontalBlock"] {
                justify-content: center !important;
            }
            </style>
        """, unsafe_allow_html=True)
    
        if not user_df.empty:
            sorted_user_df = user_df.sort_values("user_name")
            
            # 💡 最新機能: horizontal=True で中身を横に並べるコンテナ
            # これ自体は「行」を作るイメージなので、3人ずつ並べる処理を書きます
            user_list = sorted_user_df.to_dict('records')
            
            # 3人ずつ分割して表示
            for i in range(0, len(user_list), 3):
                with st.container(horizontal=True):
                    chunk = user_list[i:i+3]
                    for row in chunk:
                        btn_key = f"l_{row['user_name']}"
                        
                        if st.button(f"{row['icon']}\n{row['user_name']}", key=btn_key):
                            # アクセス履歴取得
                            from utils import init_connection
                            supabase = init_connection()
                            supabase.table("access_logs")\
                                .insert({"user_name": row['user_name']})\
                                .execute()
                            st.session_state.USER = row['user_name']
                            st.session_state.U_COLOR = row['color']
                            st.session_state.U_ICON = row['icon']
                            st.query_params["user"] = row['user_name']
                            st.rerun()
        st.stop()
    
    col_title, col_btn = st.columns([0.7, 0.3])
    with col_title: st.write(f"🧗 Let's Go Bouldering **{st.session_state.U_ICON} {st.session_state.USER}**")
    
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
    
    # 2. エリア情報のマージ
    if not gym_df.empty and not area_master.empty:
        merged_gyms = pd.merge(gym_df, area_master[['area_tag', 'major_area']], on='area_tag', how='left')
    else:
        merged_gyms = pd.DataFrame()
    
    # 3. 登録フォーム
    st.markdown(
        f'''
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.25rem; font-weight: 700; color: #31333F;">🚀 予定登録</span>
            <a href="https://embed.app.guidde.com/playbooks/nnS9LxE1oqmECWdMgzyuMt?mode=docOnly" 
               target="_blank" 
               style="font-size: 0.7rem; color: #aaa; text-decoration: none !important; white-space: nowrap;">
               ❔ 登録/削除の方法
            </a>
        </div>
        ''', 
        unsafe_allow_html=True
    )
    
    time_slot_val = None
    with st.expander("📅 予定・実績を入力する", expanded=False):
        # 2. 日付選択（カレンダーのみ）
        # 初期値の設定（初回のみ）
        if "q_date_val" not in st.session_state:
            st.session_state.q_date_val = today_jp
        
        # カレンダー
        q_date = st.date_input(
            "日付選択",
            value=st.session_state.q_date_val,
            label_visibility="collapsed"
        )
        
        # カレンダー操作があったら反映
        if q_date != st.session_state.q_date_val:
            st.session_state.q_date_val = q_date
            st.rerun()
    
        # ラジオで時間帯選択
        time_slot_val = st.radio(
            "時間帯を選択",
            options=["昼", "夕方", "夜"],
            index=0,
            key="time_slot_radio",
            horizontal=True,
            label_visibility="collapsed"
        )
                
        # エリアの並び順定義
        custom_order = ["都内・神奈川", "関東", "関西", "全国"]
        
        if not merged_gyms.empty:
            actual_areas = [a for a in merged_gyms['major_area'].unique() if pd.notna(a)]
            all_areas = [a for a in custom_order if a in actual_areas]
            all_areas += [a for a in actual_areas if a not in custom_order]
        else:
            all_areas = ["未設定"]
    
        # --- ✨ ここを追加：直近1ヶ月の訪問実績をチェック ---
        recent_gyms = []
        if not log_df.empty:
            # 30日前の日付を計算
            one_month_ago = pd.Timestamp(today_jp) - timedelta(days=30)
            # 自分の「実績」からジム名を抽出
            recent_gyms = log_df[
                (log_df['user'] == st.session_state.USER) & 
                (log_df['type'] == '実績') & 
                (log_df['date'] >= one_month_ago)
            ]['gym_name'].unique().tolist()
    
        area_tabs = st.tabs(all_areas)
        selected_gym = None
    
        for i, area in enumerate(all_areas):
            with area_tabs[i]:
                # 元のジム名リストを取得
                raw_area_gyms = sorted(merged_gyms[merged_gyms['major_area'] == area]['gym_name'].unique().tolist())
                
                if len(raw_area_gyms) > 0:
                    # 💡 表示用ラベルの作成
                    display_options = []
                    label_map = {} # 表示名から元の名前を引く用
                    
                    for g_name in raw_area_gyms:
                        if g_name in recent_gyms:
                            label = f"{g_name} ⭐"
                        else:
                            label = f"{g_name}" # ズレ防止の全角スペース
                        display_options.append(label)
                        label_map[label] = g_name
    
                    # ラジオボタン表示
                    res_label = st.radio(
                        f"{area}のジムを選択", 
                        options=display_options,
                        index=None,
                        key=f"radio_top_{area}",
                        label_visibility="collapsed" 
                    )
                    
                    # 💡 ラベルが選ばれたら、元のジム名を selected_gym に入れる
                    if res_label:
                        selected_gym = label_map[res_label]    
         
        # 3. 登録ボタン
        col1, col2 = st.columns(2)
    
        # 💡 ボタンが押されたときに「どのタブで選んだか」を特定するロジック
        btn_plan = col1.button("✋ 登るよ", use_container_width=True)
        btn_done = col2.button("✊ 登った", use_container_width=True, type="primary")
        
        # --- 💡 ここに注意書きを追加 ---
        st.markdown(
            '''
            <div style="font-size: 0.75rem; color: #888; margin-top: -10px; padding: 0 5px; line-height: 1.4;">
                ※「✋ 登るよ」で登録した予定は、その日が過ぎれば自動的に「登った記録」に反映されます。
            </div>
            ''', 
            unsafe_allow_html=True
        )
    
        if (btn_plan or btn_done) and not time_slot_val:
            st.warning("時間帯を選んでください")
        elif btn_plan or btn_done:
            # 💡 全タブをスキャンして、選ばれているジムを探す
            final_selected_gym = None
            for area in all_areas:
                k = f"radio_top_{area}"
                if k in st.session_state and st.session_state[k] is not None:
                    raw_val = st.session_state[k]
                    final_selected_gym = raw_val.replace(" ⭐", "").strip()
    
            if final_selected_gym:
                reg_type = '予定' if btn_plan else '実績'
                new_row = pd.DataFrame([{
                    'date': pd.to_datetime(q_date),
                    'gym_name': final_selected_gym,
                    'user': st.session_state.get('USER', 'Unknown'),
                    'type': reg_type,
                    'time_slot': time_slot_val
                }])
                
                # ラジオボタンをすべてリセット
                for area in all_areas:
                    if f"radio_top_{area}" in st.session_state:
                        del st.session_state[f"radio_top_{area}"]
                safe_save("climbing_logs", new_row, mode="add", target_tab = None)
            else:
                st.warning("ジムを選んでからボタンを押してね！")            
    st.divider()
    
    # 3. 3週間以内の予定一覧表示
    st.subheader("👋 一緒にのぼろー")

    # --- データの準備 ---
    from datetime import timedelta
    three_weeks_later = today_jp + timedelta(days=21)    
    future_logs = log_df[
        (log_df['type'] == '予定') & 
        (log_df['date'].dt.date >= today_jp) & 
        (log_df['date'].dt.date <= three_weeks_later)
    ].copy()

    if not future_logs.empty:
        # 💡 時間帯（time_slot）を含めて集計するために、groupbyの構成を変更します
        # 日付とジム名でグループ化
        grouped_future = future_logs.groupby(['date', 'gym_name'])
        sorted_keys = sorted(grouped_future.groups.keys())

        for d_ts, gym in sorted_keys:
            # その「日・ジム」に該当する全ユーザー行を取得
            day_gym_df = grouped_future.get_group((d_ts, gym))
            d_val = d_ts.date()
            
            # --- 1. 時間帯ごとのアイコン画像＋文字列の定義 ---
            icon_map = {
                "昼": '<img src="https://github.com/kenta-yos/climbing-schedule-app/blob/develop/images/hiru.png?raw=true" width="16"/>',
                "夕方": '<img src="https://github.com/kenta-yos/climbing-schedule-app/blob/develop/images/yuu.png?raw=true" width="16"/>',
                "夜": '<img src="https://github.com/kenta-yos/climbing-schedule-app/blob/develop/images/yoru.png?raw=true" width="16"/>'
            }

            # --- 2. 時間帯ごとにユーザーを振り分け ---
            times = {"昼": [], "夕方": [], "夜": []}
            others = [] # 時間帯が空（古いデータなど）用

            for _, row in day_gym_df.iterrows():
                u = row['user']
                ts = row.get('time_slot')
                
                if pd.isna(ts) or ts == "" or ts not in times:
                    if u not in others:
                        others.append(u)
                else:
                    if u not in times[ts]:
                        times[ts].append(u)

            # --- 3. 時間帯ごとのユーザー名を横1行にまとめる ---
            time_strs = []
            for ts in ["昼", "夕方", "夜"]:
                if times[ts]:
                    # 色付きユーザー名HTMLを取得
                    user_htmls = [get_colored_user_text(u, user_df) for u in sorted(times[ts])]
                    # アイコンラベル: ユーザーA & ユーザーB
                    time_strs.append(f"{icon_map[ts]}  {' & '.join(user_htmls)}")

            # 時間帯がないユーザーがいる場合、最後に追加（アイコンなしで名前だけ）
            if others:
                other_htmls = [get_colored_user_text(u, user_df) for u in sorted(others)]
                time_strs.append(f"{' & '.join(other_htmls)}")

            # "|" で区切って横並び表示用のHTMLを生成（空なら完全に詰まる）
            members_html = " | ".join(time_strs)

            # --- 4. 日付の表示形式とアクセントカラー（既存ロジック） ---
            if d_val == today_jp:
                date_display = "Today"
                accent_color = "#1E8449"   # 今日：緑
            elif d_val == today_jp + timedelta(days=1):
                date_display = "Tomorrow"
                accent_color = "#2E86DE"   # 明日：青
            else:
                weekdays = ["月", "火", "水", "木", "金", "土", "日"]
                d_str = d_val.strftime('%m/%d')
                w_str = weekdays[d_val.weekday()]
                date_display = f"{d_str}({w_str})"
                accent_color = "#F36C21"   # 通常：オレンジ

            # --- 5. 最終的なマークダウン出力 ---
            st.markdown(f'''
                <div style="margin-bottom: 8px; padding: 6px 12px; border-left: 4px solid {accent_color}; display: flex; align-items: flex-start;">
                    <div style="min-width: 65px; font-size: 0.85rem; color: {accent_color}; font-weight: bold; margin-top: 2px; flex-shrink: 0;">
                        {date_display}
                    </div>
                    <div style="flex-grow: 1; margin-left: 4px;">
                        <div style="font-weight: bold; color: #333; font-size: 0.95rem; line-height: 1.2; margin-bottom: 2px;">
                            {gym}
                        </div>
                        <div style="font-size: 0.85rem; line-height: 1.4;">
                            {members_html}
                        </div>
                    </div>
                </div>
            ''', unsafe_allow_html=True)
    else:
        st.caption("3週間以内に予定を入れている仲間はいません😭")
        
    # --- 4. ○月登り込みランキング (同着対応) ---
    st.divider()
    st.markdown(f'''
        <div style="font-size: 1.2rem; font-weight: 700; color: #31333F; 
                    margin: 1.5rem 0 0.8rem 0; line-height: 1.4; word-wrap: break-word;">
            🏆 {this_month}月度<br aria-hidden="true">CLIMB-BAKA AWARD
        </div>
    ''', unsafe_allow_html=True)

# 今月の実績データを抽出
    first_day_of_month = pd.Timestamp(today_jp.replace(day=1))
    this_month_logs = log_df[(log_df['type'] == '実績') & (log_df['date'] >= first_day_of_month)] if not log_df.empty else pd.DataFrame()

    # 1. 全ユーザーのベースリストを作成
    # user_dfから全ユーザー名を取得して、初期値0回のデータフレームを作る
    all_users_base = pd.DataFrame({'user': user_df['user_name'].unique()})
    all_users_base['count'] = 0

    # 2. 今月の実績がある人のカウントを取得
    if not this_month_logs.empty:
        actual_counts = this_month_logs['user'].value_counts().reset_index()
        actual_counts.columns = ['user', 'actual_count']
        
        # ベースリストに実績をマージ
        ranking = pd.merge(all_users_base, actual_counts, on='user', how='left')
        # 実績がない(NaN)人は0にする
        ranking['count'] = ranking['actual_count'].fillna(0).astype(int)
    else:
        ranking = all_users_base

    # 3. 同着を考慮した順位付け (回数が同じなら同じ順位)
    ranking['rank_num'] = ranking['count'].rank(ascending=False, method='min').astype(int)
    
    # 4. ユーザー詳細（アイコン・色）をマージしてソート
    ranking = pd.merge(ranking[['user', 'count', 'rank_num']], 
                       user_df[['user_name', 'icon', 'color']], 
                       left_on='user', right_on='user_name', how='left').sort_values(['rank_num', 'user'])

    # 5. リスト表示のループ
    for _, row in ranking.iterrows():
        r = row['rank_num']
        c = row['count']
        
        # 0回の人にはメダルを出さず、順位だけにする、などの調整も可能
        # ここでは1-3位ならメダル、それ以外（0回含む）は数字を表示
        medals = {1: "🥇", 2: "🥈", 3: "🥉"}
        rank_display = medals.get(r, f"{r}位")
        
        # 1〜3位かつ1回以上登っている場合だけ背景に色をつける（0回で3位以内に入るのを防ぐ場合）
        is_top = (r <= 3 and c > 0)
        bg_color = "#fff9e6" if is_top else "#ffffff"
        border_color = "#ffeaa7" if is_top else "#eeeeee"
        
        # 0回の人だけ少し文字を薄くする（お好みで）
        text_opacity = "1.0" if c > 0 else "0.5"

        st.markdown(f'''
            <div style="display: flex; align-items: center; background: {bg_color}; padding: 10px 15px; 
                        border-radius: 10px; border: 1px solid {border_color}; margin-bottom: 6px; opacity: {text_opacity};">
                <div style="font-size: 1.2rem; min-width: 45px; font-weight: bold;">{rank_display}</div>
                <div style="font-size: 1.3rem; margin-right: 12px;">{row['icon']}</div>
                <div style="flex-grow: 1; font-weight: bold; color: #333; font-size: 1rem;">{row['user']}</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: {row['color']};">
                    {c}<span style="font-size: 0.75rem; margin-left: 3px; color: #666;">回</span>
                </div>
            </div>
        ''', unsafe_allow_html=True)
