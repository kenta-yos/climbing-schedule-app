import streamlit as st
import pandas as pd
from datetime import datetime
# utils.py から必要な機能をインポート
from utils import get_supabase_data, get_now_jp

def show_page():
    # --- 過ぎたスケジュールをグレー字に ---
    st.markdown("""
        <style>
        .past-opacity { 
            opacity: 0.35 !important; 
            filter: grayscale(80%);
        }
        </style>
    """, unsafe_allow_html=True)
    
    # --- 初期定義 (元のコードそのまま) ---
    now_jp = get_now_jp()
    today_jp = now_jp.date()
    
    # データの取得
    gym_df = get_supabase_data("gym_master")
    sched_df = get_supabase_data("set_schedules")
    area_master = get_supabase_data("area_master")
    
    # 未ログイン時のガード
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
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
                        <span class="item-gym" style="color: #1DA1F2; font-weight: 700; font-size: 0.95rem;">{row["gym_name"]}</span>
                    </div>
                </a>
            ''', unsafe_allow_html=True)
    else:
        st.info("セットスケジュールが登録されていません。")
