-- Créer une fonction RPC pour exécuter du SQL dynamique
-- ATTENTION: Cette fonction est très puissante et doit être utilisée avec précaution
-- Elle nécessite des permissions SECURITY DEFINER pour contourner les RLS

CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;

-- Grant execute permission to authenticated users (ou service_role)
-- GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
-- GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;


