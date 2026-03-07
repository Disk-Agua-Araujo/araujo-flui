
-- Revoke EXECUTE on stock-manipulation RPCs from authenticated role
-- The admin-panel edge function uses service_role, so it will continue to work
REVOKE EXECUTE ON FUNCTION public.adjust_stock FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_for_order FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_stock FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_for_order FROM anon;
