
-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create enum types for better data integrity
create type public.video_status as enum ('draft', 'processing', 'completed', 'failed');
create type public.avatar_type as enum ('default', 'custom', 'uploaded');
create type public.voice_type as enum ('male', 'female', 'custom');

-- Create profiles table for user information
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  subscription_tier text default 'free',
  credits_remaining integer default 3,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (id)
);

-- Create avatars table for storing avatar options
create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text not null,
  avatar_type avatar_type default 'default',
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Create video_projects table for user video projects
create table public.video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  script text not null,
  avatar_id uuid references public.avatars(id),
  voice_type voice_type default 'female',
  voice_speed decimal default 1.0,
  background_color text default '#ffffff',
  status video_status default 'draft',
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create processing_jobs table for tracking video generation
create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.video_projects(id) on delete cascade not null,
  status text default 'pending',
  progress integer default 0,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.avatars enable row level security;
alter table public.video_projects enable row level security;
alter table public.processing_jobs enable row level security;

-- Create RLS policies for profiles
create policy "Users can view their own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Create RLS policies for avatars (public read)
create policy "Anyone can view active avatars" 
  on public.avatars for select 
  using (is_active = true);

-- Create RLS policies for video_projects
create policy "Users can view their own projects" 
  on public.video_projects for select 
  using (auth.uid() = user_id);

create policy "Users can create their own projects" 
  on public.video_projects for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own projects" 
  on public.video_projects for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own projects" 
  on public.video_projects for delete 
  using (auth.uid() = user_id);

-- Create RLS policies for processing_jobs
create policy "Users can view their own processing jobs" 
  on public.processing_jobs for select 
  using (
    exists (
      select 1 from public.video_projects 
      where id = processing_jobs.project_id 
      and user_id = auth.uid()
    )
  );

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Create trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert default avatars
insert into public.avatars (name, description, image_url, avatar_type) values
  ('Professional Woman', 'Professional businesswoman avatar perfect for corporate content', 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=400&h=400&fit=crop&crop=face', 'default'),
  ('Professional Man', 'Professional businessman avatar ideal for business presentations', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face', 'default'),
  ('Young Woman', 'Friendly young woman avatar great for casual and educational content', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face', 'default'),
  ('Young Man', 'Approachable young man avatar perfect for tech and lifestyle content', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face', 'default');

-- Create storage bucket for video files
insert into storage.buckets (id, name, public) values ('videos', 'videos', true);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', true);

-- Create storage policies
create policy "Anyone can view videos" on storage.objects for select using (bucket_id = 'videos');
create policy "Users can upload videos" on storage.objects for insert with check (bucket_id = 'videos' and auth.role() = 'authenticated');
create policy "Users can update their videos" on storage.objects for update using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their videos" on storage.objects for delete using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Anyone can view thumbnails" on storage.objects for select using (bucket_id = 'thumbnails');
create policy "Users can upload thumbnails" on storage.objects for insert with check (bucket_id = 'thumbnails' and auth.role() = 'authenticated');

-- Create function to update timestamps
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_video_projects_updated_at before update on public.video_projects
  for each row execute procedure public.update_updated_at_column();
