import streamlit as st
import pandas as pd
# utils.py から必要な機能をインポート
from utils import get_supabase_data

def show_page():
    # --- 初期定義 (元のコードそのまま) ---
    gym_df = get_supabase_data("gym_master")
    area_master = get_supabase_data("area_master")
    log_df = get_supabase_data("climbing_logs")
    sched_df = get_supabase_data("set_schedules")
    
    # 日付計算の準備
    now_jp = get_now_jp()
    t_dt = pd.Timestamp(now_jp.date())
    
    # 未ログイン時のガード
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
    st.query_params["tab"] = "🏠 ジム"    
    st.subheader("🏢 ジムライブラリ")
    
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
