 require 'sinatra'

set :public_folder, __dir__ + '/'

#  get '/' do
#    'index'
#  end
#
# get '/:path' do
#   begin
#     if(params[:path].end_with?('.html'))
#       File.read(params[:path])
#     else
#       File.read("#{params[:path]}.html")
#     end
#   rescue
#     '沒有檔案'
#   end
# end
