import streamlit as st
import pandas as pd
from datetime import datetime
from datetime import timedelta
# utils.py から必要な機能をインポート
from utils import get_supabase_data, get_now_jp

def show_page():
    from utils import get_now_jp
    
    # --- 初期定義 (元のコードそのまま) ---
    gym_df = get_supabase_data("gym_master")
    area_master = get_supabase_data("area_master")
    log_df = get_supabase_data("climbing_logs")
    sched_df = get_supabase_data("set_schedules")

    # 日付計算の準備
    now_jp = get_now_jp()
    today_jp = now_jp.date()

    # 未ログイン時のガード
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
    st.query_params["tab"] = "🏠 ジム"    
    
    st.subheader("✨ おすすめジム")
    # 1. ターゲット設定
    c_date1, c_date2 = st.columns([0.6, 0.4])
    target_date = c_date1.date_input("ターゲット日", value=today_jp, key="tg_date")
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
            
    st.divider()

    st.subheader("🏢 ジム一覧")
    if not gym_df.empty:
        # --- 1. データの準備 ---
        my_done_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')] if not log_df.empty else pd.DataFrame()
        
        # ジムごとに最新訪問日を辞書化
        last_visit_dict = {}
        if not my_done_logs.empty:
            last_visit_dict = my_done_logs.groupby('gym_name')['date'].max().to_dict()
    
        # 訪問済みと未訪問に分けるリスト
        visited_list = []
        unvisited_list = []
        
        # 今月の開始日を取得（2026-02-01）
        this_month_start = t_dt.replace(day=1).date()
    
        for _, row in gym_df.iterrows():
            g_name = row['gym_name']
            
            # --- 今月のセットスケジュールがあるかチェック ---
            has_sched = False
            if not sched_df.empty:
                has_sched = not sched_df[
                    (sched_df['gym_name'] == g_name) & 
                    (sched_df['start_date'] >= pd.Timestamp(this_month_start))
                ].empty
    
            gym_data = {
                "name": g_name,
                "area": row['area_tag'],
                "url": row.get('profile_url', '#'),
                "last_date": last_visit_dict.get(g_name),
                "no_sched": not has_sched  # スケジュールがなければ警告対象
            }
    
            if g_name in last_visit_dict:
                visited_list.append(gym_data)
            else:
                unvisited_list.append(gym_data)
    
        # 訪問済みを日付順にソート
        visited_list.sort(key=lambda x: x['last_date'], reverse=True)
    
        # --- 2. UI表示 ---
        g_tabs = st.tabs(["✅ 訪問済", "🔍 未訪問"])
        
        # スタイル定義
        st.markdown("""
            <style>
            .gym-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f9f9f9; text-decoration: none !important; }
            .gym-info { display: flex; flex-direction: column; }
            .gym-n { font-size: 0.9rem; font-weight: 600; color: #1DA1F2; }
            .gym-a { font-size: 0.7rem; color: #999; }
            .gym-d { font-size: 0.75rem; font-weight: 700; color: #4CAF50; background: #e8f5e9; padding: 2px 8px; border-radius: 4px; }
            .warn-tag { font-size: 0.6rem; color: #ff4b4b; background: #fff1f0; border: 1px solid #ffa39e; padding: 1px 4px; border-radius: 3px; margin-left: 5px; vertical-align: middle; }
            </style>
        """, unsafe_allow_html=True)
    
        with g_tabs[0]: # 訪問済
            if not visited_list:
                st.caption("まだ訪問実績がありません。")
            else:
                for g in visited_list:
                    warn_html = '<span class="warn-tag">⚠️セット未登録</span>' if g['no_sched'] else ''
                    st.markdown(f'''
                        <a href="{g['url']}" target="_blank" class="gym-row">
                            <div class="gym-info">
                                <span class="gym-n">🔹 {g['name']}{warn_html}</span>
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
                    warn_html = '<span class="warn-tag">⚠️予定未登録</span>' if g['no_sched'] else ''
                    st.markdown(f'''
                        <a href="{g['url']}" target="_blank" class="gym-row">
                            <div class="gym-info">
                                <span class="gym-n">⬜ {g['name']}{warn_html}</span>
                                <span class="gym-a">{g['area']}</span>
                            </div>
                            <span style="font-size: 0.7rem; color: #ccc;">未踏</span>
                        </a>
                    ''', unsafe_allow_html=True)
    else:
        st.info("ジムマスターが空です。管理タブから登録してください。")
