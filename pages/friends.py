import streamlit as st
import pandas as pd
from datetime import timedelta
# utils.py から必要な機能をインポート
from utils import get_supabase_data, get_now_jp, get_colored_user_text

def show_page():
    # --- 初期定義 (元のコードそのまま) ---
    now_jp = get_now_jp()
    today_jp = now_jp.date()
    today_ts = pd.Timestamp(today_jp)
    
    # データの取得
    log_df = get_supabase_data("climbing_logs")
    user_df = get_supabase_data("users")
    
    # 未ログイン時のガード
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
    st.query_params["tab"] = "👥 仲間"
    st.subheader("👥 仲間たちの予定 (直近30日)")
    
    # 1. 表示オプション
    include_me = st.toggle("自分の予定も表示する", value=False, key="check_include_me")
    
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
