import streamlit as st
import pandas as pd
import pytz
from datetime import datetime
from st_supabase_connection import SupabaseConnection

# --- 日本時間の定義 ---
jp_timezone = pytz.timezone('Asia/Tokyo')

def get_now_jp():
    return datetime.now(jp_timezone)

# --- Supabase 接続 & データ取得 ---
def init_connection():
    return st.connection("supabase", type=SupabaseConnection)

def get_supabase_data(table_name):
    @st.cache_data(ttl=10)
    def _read(name):
        conn = init_connection()
        try:
            res = conn.table(name).select("*").execute()
            if not res.data: return pd.DataFrame()
            df = pd.DataFrame(res.data)
            date_cols = ['date', 'start_date', 'end_date', 'created_at']
            for col in date_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col]).dt.tz_localize(None)
            return df
        except Exception as e:
            st.error(f"Error reading {name}: {e}")
            return pd.DataFrame()
    return _read(table_name)

# --- 保存・削除処理 (元のロジックを完全維持) ---
def safe_save(table: str, data_input, mode: str = "add"):
    conn = init_connection()
    try:
        if mode == "add":
            if not data_input.empty:
                data_to_insert = data_input.to_dict(orient="records")
                for d in data_to_insert:
                    for key in ['date', 'start_date', 'end_date']:
                        if key in d and hasattr(d[key], 'isoformat'):
                            d[key] = d[key].isoformat()
                conn.table(table).insert(data_to_insert).execute()
        elif mode == "delete":
            conn.table(table).delete().eq("id", data_input).execute()
        
        st.cache_data.clear()
        st.session_state.toast_msg = "登録したよ🚀" if mode == "add" else "削除したよ🙆‍♂️"
        return True
    except Exception as e:
        st.error(f"⚠️ エラー: {e}")
        return False

# --- ユーザー表示ヘルパー ---
def get_colored_user_text(user_name, user_df):
    u_color, u_icon = "#555555", "👤"
    if user_df is not None and not user_df.empty:
        match = user_df[user_df['user_name'] == user_name]
        if not match.empty:
            u_color = match.iloc[0]['color']
            u_icon = match.iloc[0]['icon']
    style = f"color: {u_color}; font-weight: 800; text-shadow: 1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff; padding: 0 2px;"
    return f'<span style="{style}">{u_icon}{user_name}</span>'

# --- 共通スタイル (元のCSSを完コピ) ---
def apply_common_style():
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
        .item-box { display: grid !important; grid-template-columns: 4px 60px 1fr 40px !important; align-items: center !important; gap: 8px !important; padding: 14px 0 !important; border-bottom: 1px solid #F0F0F0 !important; }
        .set-box { display: grid !important; grid-template-columns: 4px 105px 1fr !important; align-items: center !important; gap: 12px !important; padding: 15px 5px !important; border-bottom: 1px solid #F0F0F0 !important; width: 100% !important; }
        .item-accent { width: 4px !important; height: 1.4rem !important; border-radius: 2px !important; flex-shrink: 0; }
        .item-date { color: #B22222 !important; font-weight: 700 !important; font-size: 0.85rem !important; white-space: nowrap !important; }
        .item-gym { color: #1A1A1A !important; font-weight: 700 !important; font-size: 0.95rem !important; }
        .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; }
        .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; }
        .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }
        .compact-row { display: grid; grid-template-columns: 4px 45px 1fr; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .compact-date { font-size: 0.8rem; font-weight: 700; color: #666; }
        .compact-gym { font-size: 0.85rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        </style>
    """, unsafe_allow_html=True)
