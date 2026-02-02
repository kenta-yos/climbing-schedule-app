import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date
import calendar
import plotly.express as px

st.set_page_config(page_title="セット管理Pro", layout="centered")

# --- 究極の崩れ防止CSS（改訂版） ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 2rem; }

    /* インスタ風サマリーカード */
    .insta-card {
        background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%);
        color: white; padding: 20px; border-radius: 15px; text-align: center;
        margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .insta-val { font-size: 2.2rem; font-weight: 800; }
    .insta-label { font-size: 0.8rem; opacity: 0.9; }

    /* 【重要】絶対に崩れないリスト構造 */
    .item-box {
        display: grid !important;
        grid-template-columns: 4px 100px 1fr !important; /* 幅を完全に固定配分 */
        align-items: center !important;
        gap: 12px !important;
        padding: 14px 0 !important;
        border-bottom: 1px solid #F0F0F0 !important;
        width: 100% !important;
        text-decoration: none !important;
    }
    .item-accent {
        width: 4px !important;
        height: 1.4rem !important;
        background-color: #B22222 !important;
        border-radius: 2px !important;
    }
    .item-date {
        color: #B22222 !important;
        font-weight: 700 !important;
        font-size: 0.85rem !important;
        white-space: nowrap !important; /* 絶対に改行させない */
    }
    .item-gym {
        color: #1A1A1A !important;
        font-weight: 700 !important;
        font-size: 0.95rem !important;
        white-space: nowrap !important; /* 絶対に改行させない */
        overflow: hidden !important; /* 溢れたら隠す */
        text-overflow: ellipsis !important; /* 溢れたら「...」にする */
        min-width: 0 !important; /* grid内での省略を有効化 */
    }
    .past-opacity { opacity: 0.35 !important; }

    /* ジム一覧のカード */
    .gym-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 15px !important;
        margin-bottom: 10px !important;
        background-color: #F8F9FA !important;
        border-radius: 10px !important;
        border: 1px solid #E9ECEF !important;
        text-decoration: none !important;
    }
    .gym-name { color: #1A1A1A !important; font-weight: 700; flex-grow: 1; margin-right: 10px; }
    .gym-meta { color: #888 !important; font-size: 0.75rem !important; flex-shrink: 0; }
    </style>
    """, unsafe_allow_html=True)

# --- データ取得（API保護） ---
conn = st.connection("gsheets", type=GSheetsConnection)
def load_all_data():
    m = conn.read(worksheet="gym_master", ttl=10)
    s = conn.read(worksheet="schedules", ttl=10)
    l = conn.read(worksheet="climbing_logs", ttl=10)
    return m, s, l

try:
    master_df, schedule_df, log_df = load_all_data()
except:
    st.error("Google API制限中です。少し待って再読み込みしてください。")
    st.stop()

sorted_gyms = sorted(master_df['gym_name'].tolist()) if not master_df.empty else []
if 'date_count' not in st.session_state: st.session_state.date_count = 1

tab1, tab2, tab3 = st.tabs(["セットスケジュール", "ログ", "ジム"])

# ==========================================
# Tab 1: セットスケジュール
# ==========================================
with tab1:
    with st.expander("＋ スケジュールを登録"):
        with st.form("add_form", clear_on_submit=True):
            sel_gym = st.selectbox("ジム", options=["(選択)"] + sorted_gyms)
            p_url = st.text_input("Instagram URL")
            for i in range(st.session_state.date_count):
                st.write(f"日程 {i+1}")
                c1, c2 = st.columns(2)
                with c1: s_d = st.date_input(f"開始日", key=f"s_date_{i}")
                with c2: e_d = st.date_input(f"終了日", value=s_d, key=f"e_date_{i}")
            if st.form_submit_button("保存"):
                if sel_gym != "(選択)":
                    new_rows = [{"gym_name": sel_gym, "start_date": st.session_state[f"s_date_{j}"].isoformat(), "end_date": st.session_state[f"e_date_{j}"].isoformat(), "post_url": p_url} for j in range(st.session_state.date_count)]
                    conn.update(worksheet="schedules", data=pd.concat([schedule_df, pd.DataFrame(new_rows)], ignore_index=True))
                    st.session_state.date_count = 1; st.rerun()
        if st.button("＋ 日程を増やす"):
            st.session_state.date_count += 1; st.rerun()

    if not schedule_df.empty:
        s_df = schedule_df.copy(); s_df['start_date'] = pd.to_datetime(s_df['start_date']); s_df['end_date'] = pd.to_datetime(s_df['end_date'])
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=months, index=months.index(cur_m) if cur_m in months else 0)
        
        for _, row in s_df[s_df['month_year'] == sel_m].sort_values('start_date').iterrows():
            is_past = row['end_date'].date() < date.today()
            d_s, d_e = row['start_date'].strftime('%m/%d'), row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            st.markdown(f"""
                <a href="{row['post_url']}" target="_blank" class="item-box {'past-opacity' if is_past else ''}">
                    <div class="item-accent"></div>
                    <span class="item-date">{d_disp}</span>
                    <span class="item-gym">{row['gym_name']}</span>
                </a>
            """, unsafe_allow_html=True)

# ==========================================
# Tab 2: ログ
# ==========================================
with tab2:
    with st.expander("＋ 登攀を記録"):
        with st.form("log_form", clear_on_submit=True):
            l_date = st.date_input("日付", value=date.today())
            l_gym = st.selectbox("ジムを選択", options=["(選択)"] + sorted_gyms)
            if st.form_submit_button("保存"):
                if l_gym != "(選択)":
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, pd.DataFrame([{"date": l_date.isoformat(), "gym_name": l_gym}])], ignore_index=True))
                    st.rerun()

# --- Tab 2: ログ（可視化改善・アイコン除去版） ---
with tab2:
    # ...（前後の登録フォームなどはそのまま維持）...

    if not log_df.empty:
        # ...（日付選択ロジックなどはそのまま）...
        
        if not disp_df.empty:
            # インスタ風サマリーカード
            st.markdown(f'<div class="insta-card"><div class="insta-label">{start_q.strftime("%m/%d")} 〜 {end_q.strftime("%m/%d")}</div><div style="display: flex; justify-content: space-around; margin-top: 10px;"><div><div class="insta-val">{len(disp_df)}</div><div class="insta-label">Sessions</div></div><div><div class="insta-val">{disp_df["gym_name"].nunique()}</div><div class="insta-label">Gyms</div></div></div></div>', unsafe_allow_html=True)
            
            counts = disp_df['gym_name'].value_counts().reset_index()
            counts.columns = ['gym_name', 'count']
            
            # --- グラフ描画：configを追加してアイコンを消去 ---
            fig = px.pie(counts, values='count', names='gym_name', hole=0.5, 
                         color_discrete_sequence=px.colors.qualitative.Pastel)
            
            fig.update_traces(
                textinfo='label+value',
                texttemplate='<b>%{label}</b><br>(%{value}回)', # 太字にして視認性アップ
                textposition='outside',
                marker=dict(line=dict(color='#FFFFFF', width=2)) # ピースの境界線を白にして清潔感を
            )
            
            fig.update_layout(
                showlegend=False,
                margin=dict(t=20, b=20, l=60, r=60), # ラベルが切れないよう左右余白を調整
                height=450,
                paper_bgcolor='rgba(0,0,0,0)',
                font=dict(size=12, color="#444") # フォントサイズを少し大きく
            )

            # config={'displayModeBar': False} でカメラアイコン等を非表示
            st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})

            for _, row in disp_df.sort_values('date', ascending=False).iterrows():
                st.markdown(f"""
                    <div class="item-box">
                        <div class="item-accent"></div>
                        <span class="item-date">{row['date'].strftime('%m/%d')}</span>
                        <span class="item-gym">{row['gym_name']}</span>
                    </div>
                """, unsafe_allow_html=True)

# ==========================================
# Tab 3: ジム
# ==========================================
with tab3:
    with st.expander("＋ 新しいジムを登録"):
        with st.form("gym_add"):
            n = st.text_input("ジム名"); u = st.text_input("Instagram URL")
            if st.form_submit_button("登録"):
                if n and u:
                    conn.update(worksheet="gym_master", data=pd.concat([master_df, pd.DataFrame([{"gym_name": n, "profile_url": u}])], ignore_index=True))
                    st.rerun()
    last_v = {}
    if not log_df.empty:
        df_v = log_df.copy(); df_v['date'] = pd.to_datetime(df_v['date'])
        last_v = df_v.groupby('gym_name')['date'].max().dt.strftime('%Y/%m/%d').to_dict()
    for gym in sorted_gyms:
        url = master_df[master_df['gym_name'] == gym]['profile_url'].iloc[0]
        st.markdown(f'<a href="{url}" target="_blank" class="gym-row"><span class="gym-name">{gym}</span><span class="gym-meta">Last: {last_v.get(gym, "-")}</span></a>', unsafe_allow_html=True)
