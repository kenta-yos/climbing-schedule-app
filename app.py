import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime
import plotly.express as px # グラフ用

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- CSS（共通） ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; background-color: #F0F2F5; }
    div[data-testid="stMetric"] { background-color: white; padding: 10px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    /* カード風表示の共通設定 */
    div[data-testid="stLinkButton"] > a {
        display: block !important; width: 100% !important; background-color: white !important;
        color: #1C1E21 !important; border: none !important; border-radius: 10px !important;
        padding: 14px 18px !important; margin-bottom: 10px !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important; border-left: 5px solid #2E7D32 !important;
        text-align: left !important; line-height: 1.5 !important;
    }
    </style>
    """, unsafe_allow_html=True)

# --- データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    m = conn.read(worksheet="gym_master", ttl=0)
    s = conn.read(worksheet="schedules", ttl=0)
    l = conn.read(worksheet="climbing_logs", ttl=0)
    return m, s, l

master_df, schedule_df, log_df = load_all_data()
sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []

tab1, tab2, tab3 = st.tabs(["🗓 セット予定", "✅ 登攀ログ", "🔍 ジム名鑑"])

# ==========================================
# Tab 2: 登攀ログ（新機能）
# ==========================================
with tab2:
    # --- 記録入力エリア ---
    with st.expander("＋ 今日の登攀を記録する"):
        with st.form("log_form", clear_on_submit=True):
            log_date = st.date_input("日付", value=datetime.now().date())
            log_gym = st.selectbox("ジムを選択", options=sorted_gyms)
            if st.form_submit_button("記録を保存"):
                new_log = pd.DataFrame([{"date": log_date.isoformat(), "gym_name": log_gym}])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_log], ignore_index=True))
                st.toast(f"🎉 {log_gym} での登攀を記録しました！")
                st.rerun()

    if not log_df.empty:
        df_l = log_df.copy()
        df_l['date'] = pd.to_datetime(df_l['date'])
        df_l['month_year'] = df_l['date'].dt.strftime('%Y年%m月')
        
        # --- 期間切り替え ---
        view_mode = st.radio("表示期間", ["今月のみ", "全期間"], horizontal=True, label_visibility="collapsed")
        
        if view_mode == "今月のみ":
            current_month = datetime.now().strftime('%Y年%m月')
            display_df = df_l[df_l['month_year'] == current_month]
            st.subheader(f"📊 {current_month} の統計")
        else:
            display_df = df_l
            st.subheader("📊 全期間の統計")

        if not display_df.empty:
            # --- メトリクス表示 ---
            total_days = len(display_df)
            unique_gyms = display_df['gym_name'].nunique()
            c1, c2 = st.columns(2)
            c1.metric("登攀回数", f"{total_days} 回")
            c2.metric("訪れたジム", f"{unique_gyms} 箇所")

            # --- 可視化（グラフ） ---
            gym_counts = display_df['gym_name'].value_counts().reset_index()
            gym_counts.columns = ['ジム名', '回数']
            
            fig = px.pie(gym_counts, values='回数', names='ジム名', 
                         hole=0.4, color_discrete_sequence=px.colors.sequential.Greens_r)
            fig.update_layout(margin=dict(t=0, b=0, l=0, r=0), height=250, showlegend=True)
            st.plotly_chart(fig, use_container_width=True)

            # --- 履歴リスト ---
            st.write("📝 履歴")
            for _, row in display_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f"""
                <div style="background:white; padding:10px 15px; border-radius:8px; margin-bottom:8px; border-left:4px solid #4CAF50; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <span style="font-size:0.8rem; color:#666;">{row['date'].strftime('%m/%d (%a)')}</span><br>
                    <span style="font-weight:700; font-size:1rem;">{row['gym_name']}</span>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("データがありません")

# --- Tab 1 & Tab 3 は既存機能を維持（省略して記載しますが、実装には含めます） ---
with tab1:
    st.write("（ここに既存のセットスケジュール機能を配置）")
with tab3:
    st.write("（ここに既存のジム名鑑機能を配置）")
