
CREATE OR REPLACE FUNCTION public.generate_solicitacao_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  projeto_numero TEXT;
  next_seq INT;
BEGIN
  SELECT numero INTO projeto_numero FROM public.projects WHERE id = NEW.projeto_id;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN numero ~ ('^' || regexp_replace(projeto_numero, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '-\d+$') 
      THEN CAST(SUBSTRING(numero FROM LENGTH(projeto_numero) + 2) AS INT)
      ELSE 0 
    END
  ), 0) + 1 INTO next_seq
  FROM public.solicitacoes
  WHERE projeto_id = NEW.projeto_id;
  
  NEW.numero := projeto_numero || '-' || LPAD(next_seq::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;
