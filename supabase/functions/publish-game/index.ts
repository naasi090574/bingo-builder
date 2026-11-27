import { publicationHandler } from '../_shared/publication.mjs';
import { publicationServices } from '../_shared/supabase.ts';

Deno.serve(publicationHandler('write', publicationServices()));
