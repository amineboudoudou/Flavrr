-- Create blog_posts table
create table public.blog_posts (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) not null,
  created_by uuid references auth.users(id) not null,
  
  title_fr text not null,
  title_en text not null,
  excerpt_fr text not null,
  excerpt_en text not null,
  content_fr text not null,
  content_en text not null,
  image_url text,
  
  is_published boolean default false,
  published_at timestamp with time zone,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.blog_posts enable row level security;

-- Policies
create policy "Public blog posts are viewable by everyone"
  on public.blog_posts for select
  using ( is_published = true );

create policy "Owners can do everything with their blog posts"
  on public.blog_posts for all
  using ( org_id in (
    select org_id from public.profiles
    where user_id = auth.uid()
    and role in ('owner', 'manager', 'admin')
  ));

-- Service role policy
create policy "Service role can do everything"
  on public.blog_posts for all
  using ( true )
  with check ( true );
