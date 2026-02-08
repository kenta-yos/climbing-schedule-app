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
    
    # 2. 優先順位付きジムリストの作成
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
    st.subheader("🚀 予定登録")
    
    with st.expander("📅 予定・実績を入力する", expanded=False):
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
                        
        st.divider()
    
        # 2. 日付選択
        # 初期値の設定（初回のみ）
        if "q_date_val" not in st.session_state:
            st.session_state.q_date_val = today_jp
    
        # ① 選択中表示
        current_date_str = st.session_state.q_date_val.strftime('%Y/%m/%d (%a)')
        st.info(f"📅 選択中: **{current_date_str}**")
    
        # ② カレンダー（keyを直接計算に使わない名前に変更）
        # valueにsession_stateを使い、変化を検知したら反映させる
        q_date = st.date_input(
            "カレンダーで選択", 
            value=st.session_state.q_date_val, 
            label_visibility="collapsed"
        )
        # カレンダーが直接触られたら、値を更新
        if q_date != st.session_state.q_date_val:
            st.session_state.q_date_val = q_date
            st.rerun()
    
        # ③ －1日 / ＋1日 ボタン
        c_minus, c_plus = st.columns(2)
    
        with c_minus:
            if st.button("⬅️ 1日", use_container_width=True):
                # ここで直接代入しても、keyと被っていなければエラーになりません
                st.session_state.q_date_val -= pd.Timedelta(days=1)
                st.rerun()
    
        with c_plus:
            if st.button("1日 ➡️", use_container_width=True):
                st.session_state.q_date_val += pd.Timedelta(days=1)
                st.rerun()
                                
        st.divider()
         
        # 3. 登録ボタン
        col1, col2 = st.columns(2)
    
        # 💡 ボタンが押されたときに「どのタブで選んだか」を特定するロジック
        btn_plan = col1.button("✋ 登るよ", use_container_width=True)
        btn_done = col2.button("✊ 登った", use_container_width=True, type="primary")
    
        if btn_plan or btn_done:
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
                    'type': reg_type
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
    
    # 今日から3週間後までの「予定」ログを抽出
    future_logs = log_df[
        (log_df['type'] == '予定') & 
        (log_df['date'].dt.date >= today_jp) & 
        (log_df['date'].dt.date <= three_weeks_later)
    ].copy()

    if not future_logs.empty:
        # 日付とジム名でグループ化して、ユーザーをリストにまとめる
        # 日付は昇順（近い順）、ジム名は五十音順
        grouped_future = future_logs.groupby(['date', 'gym_name'])['user'].apply(list).reset_index()
        grouped_future = grouped_future.sort_values(['date', 'gym_name'])

        for _, row in grouped_future.iterrows():
            d_val = row['date'].date()
            gym = row['gym_name']
            
            # 日付の表示形式を調整 (例: 02/14(土))
            weekdays = ["月", "火", "水", "木", "金", "土", "日"]
            d_str = d_val.strftime('%m/%d')
            w_str = weekdays[d_val.weekday()]
            date_display = f"{d_str}({w_str})"
            
            # ユーザー名のHTML化（重複排除・ソート）
            unique_users = sorted(list(set(row['user'])))
            user_htmls = [get_colored_user_text(u, user_df) for u in unique_users]
            members_html = " & ".join(user_htmls)
            
            # 今日の予定だけ色を変えるアクセント処理
            is_today = (d_val == today_jp)
            accent_color = "#D93A49" if is_today else "#F36C21"

            st.markdown(f'''
                <div style="margin-bottom: 8px; padding: 6px 12px; border-left: 4px solid {accent_color}; {bg_style} display: flex; align-items: flex-start;">
                    <div style="min-width: 65px; font-size: 0.85rem; color: {accent_color}; margin-top: 2px; flex-shrink: 0;">
                        {date_display}
                    </div>
                    <div style="flex-grow: 1; margin-left: 4px;">
                        <div style="font-weight: bold; color: #333; font-size: 0.95rem; line-height: 1.2; margin-bottom: 2px;">
                            {gym}
                        </div>
                        <div style="font-size: 0.9rem; line-height: 1.4;">
                            {members_html}
                        </div>
                    </div>
                </div>
            ''', unsafe_allow_html=True)
    else:
        st.caption("3週間以内に予定を入れている仲間はいません😭")
        
    st.divider()
    
    st.subheader("✨ おすすめジム")
    # 1. ターゲット設定
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
    
    # 4. スコアリングロジック
    ranked_list = []
    if not gym_df.empty:
        for _, gym in gym_df.iterrows():
            # エリアフィルタ
            if gym['area_tag'] not in allowed_tags:
                continue
    
            name, score, reasons = gym['gym_name'], 0, []
    
            # --- 🆕 追加：既訪フィルタ (セット後に訪問済みなら非表示) ---
            # 1. このジムの最新セット日を取得
            latest_set_date = None
            if not sched_df.empty:
                gym_sets = sched_df[(sched_df['gym_name'] == name) & (sched_df['end_date'] <= t_dt)]
                if not gym_sets.empty:
                    latest_set_date = gym_sets['end_date'].max().date()
    
            # 2. 自分のこのジムへの最新訪問日を取得
            latest_visit_date = None
            if not log_df.empty:
                my_visits = log_df[
                    (log_df['gym_name'] == name) & 
                    (log_df['user'] == st.session_state.USER) & 
                    (log_df['type'] == '実績')
                ]
                if not my_visits.empty:
                    latest_visit_date = my_visits['date'].max().date()
    
            # 3. 判定：最新セット日よりも後に訪問していたらスキップ
            if latest_set_date and latest_visit_date:
                if latest_visit_date >= latest_set_date:
                    continue  # すでに登り済みなのでおすすめに出さない
    
            # --- ① 鮮度スコア（セット終了日基準） ---
            if latest_set_date:
                diff = (t_dt.date() - latest_set_date).days
                if 0 <= diff <= 7: 
                    score += 40
                    reasons.append(f"🔥 新セット({diff}日前)")
                elif 8 <= diff <= 14: 
                    score += 30
                    reasons.append(f"✨ 準新セット({diff}日前)")
    
            # --- ② 仲間スコア ---
            if not log_df.empty:
                others = log_df[
                    (log_df['gym_name'] == name) & 
                    (log_df['user'] != st.session_state.USER) & 
                    (log_df['type'] == '予定') & 
                    (log_df['date'] == t_dt)
                ]
                if not others.empty:
                    score += 15
                    reasons.append(f"👥 仲間{len(others)}名")
                
            # --- ③ 実績スコア ---
            if not latest_visit_date:
                score += 10
                reasons.append("🆕 未訪問")
            else:
                last_v_days = (t_dt.date() - latest_visit_date).days
                if last_v_days >= 30: 
                    score += 20
                    reasons.append(f"⌛ {last_v_days}日ぶり")
    
            if reasons:
                default_date = pd.Timestamp("2000-01-01").date()
                ranked_list.append({
                    "name": name, "score": score, "reasons": reasons, 
                    "area": gym['area_tag'], "url": gym['profile_url'],
                    "latest_set_date": latest_set_date if latest_set_date else default_date
                })
                
        # 5. スコア上位表示
        if ranked_list:
            sorted_gyms = sorted(
                ranked_list, 
                key=lambda x: (x['score'], x['latest_set_date']), 
                reverse=True
            )[:5]
            
            for gym in sorted_gyms:
                # タグ生成
                tag_html = ""
                for r in gym['reasons']:
                    is_sp = any(x in r for x in ["🔥", "👥"])
                    bg, clr, brd = ("#fff0f0", "#ff4b4b", "#ffdada") if is_sp else ("#f0f7ff", "#007bff", "#cce5ff")
                    tag_html += f'<span style="background:{bg}; color:{clr}; border:1px solid {brd}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px; font-weight: 600; display: inline-block; margin-bottom: 4px;">{r}</span>'
                
                # カード表示（f-stringの波括弧問題を避けるため分割結合）
                card_html = (
                    '<div style="background: white; padding: 12px; border-radius: 10px; border: 1px solid #eee; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">'
                    '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">'
                    f'<a href="{gym["url"]}" target="_blank" style="color:#333; font-weight:700; text-decoration:none; font-size: 0.95rem;">🔹 {gym["name"]}</a>'
                    f'<span style="color: #999; font-size: 0.7rem; background: #f8f8f8; padding: 2px 6px; border-radius: 4px;">📍 {gym["area"]}</span>'
                    '</div>'
                    f'<div style="line-height: 1.2;">{tag_html}</div>'
                    '</div>'
                )
                st.markdown(card_html, unsafe_allow_html=True)
        else:
            st.info("条件に合うジムが見つかりません。")
