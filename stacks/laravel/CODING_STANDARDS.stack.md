
## Laravel

- Thin controllers: validation in Form Requests, authorization in Policies, business logic in Actions/Services. (Each piece testable alone.)
- Eloquent relationships are eager-loaded where lists render them. (N+1 queries are the default failure.)
- Mass assignment only through explicit `$fillable`; never `$guarded = []`.
- `config()` in code, `env()` only in `config/*.php`. (Config caching breaks `env()` elsewhere.)
- Database writes that must succeed together run in `DB::transaction()`.
