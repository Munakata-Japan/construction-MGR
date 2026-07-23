/* ============================================================
   建設統合管理システム  接続設定
   BUILD: config v20260723A
   ------------------------------------------------------------
   ここに書かれているキーは「公開して使う前提」のものです。
   全データの保護は Supabase 側（RLS）で行っているため、
   このファイルが見えても、ログインしない限り中身は取得できません。
   ============================================================ */

const SUPABASE_URL      = 'https://yczsbibbziorccwjotkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenNiaWJiemlvcmNjd2pvdGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NDI3OTEsImV4cCI6MjEwMDMxODc5MX0.m75flNMaCo8yk-i4O89-p4qTTyIj-2ZR1_mc3NfYLqY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
